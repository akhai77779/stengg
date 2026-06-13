import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Send, Paperclip, X, FileText, Loader2, Bot, RefreshCcw, RotateCcw, Type, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useLiveChatMessages, type LiveChatMessage } from "@/hooks/useLiveChatMessages";
import { useLiveChatTyping } from "@/hooks/useLiveChatTyping";
import { useLiveChatRooms } from "@/hooks/useLiveChatRooms";
import { useLiveChatBot } from "@/hooks/useLiveChatBot";
import { useOnlineAgentBadge } from "@/hooks/useAgentPresence";
import {
  initGuestSession,
  rehydrateGuestHeaders,
  loadGuestSession,
} from "@/lib/guestChatAuth";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import stLogo from "@/assets/st-logo.png";
import { useSignedUploadUrl } from "@/hooks/useSignedUploadUrl";

function SupportAttachment({
  url,
  name,
  type,
  isOwn,
}: {
  url: string;
  name: string | null;
  type: "image" | "file" | null;
  isOwn: boolean;
}) {
  const signed = useSignedUploadUrl(url);
  if (!signed) return null;
  return (
    <div className="mt-2">
      {type === "image" ? (
        <a href={signed} target="_blank" rel="noopener noreferrer">
          <img
            src={signed}
            alt={name || ""}
            className="max-h-48 max-w-full rounded-lg object-cover"
          />
        </a>
      ) : (
        <a
          href={signed}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs",
            isOwn ? "bg-white/10 hover:bg-white/20" : "bg-white hover:bg-slate-50"
          )}
        >
          <FileText className="h-4 w-4" />
          <span className="truncate">{name || "File"}</span>
        </a>
      )}
    </div>
  );
}

const SUGGESTED_QUESTIONS = [
  "ST Engineering có những mảng kinh doanh chính nào?",
  "Làm sao để nạp tiền vào tài khoản?",
  "Cách giao dịch quyền chọn (options) như thế nào?",
  "Tôi cần liên hệ hỗ trợ kỹ thuật ở đâu?",
];

export default function Support() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAuthenticated = !!user;
  const { findOrCreateRoom } = useLiveChatRooms();
  const { isOnline: hasOnlineAgent } = useOnlineAgentBadge();

  const [roomId, setRoomId] = useState<string | null>(null);
  const [isNewRoom, setIsNewRoom] = useState(false);
  const [guestInfo, setGuestInfo] = useState<{ id: string; name: string; email?: string } | null>(null);
  const [initError, setInitError] = useState<string | null>(null);

  const customerId = user?.id || guestInfo?.id || "";
  const customerName = user?.email?.split("@")[0] || guestInfo?.name || "Khách";

  // Rehydrate guest headers
  useEffect(() => {
    if (!isAuthenticated) rehydrateGuestHeaders();
  }, [isAuthenticated]);

  // Auto guest info
  useEffect(() => {
    if (isAuthenticated || guestInfo) return;
    const session = loadGuestSession();
    if (session) {
      setGuestInfo({ id: session.guest_id, name: `Khách #${session.guest_id.slice(-4)}` });
    } else {
      let id = localStorage.getItem("live_chat_guest_id");
      if (!id) {
        id = `guest_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        localStorage.setItem("live_chat_guest_id", id);
      }
      setGuestInfo({ id, name: `Khách #${id.slice(-4)}` });
    }
  }, [isAuthenticated, guestInfo]);

  // Init room
  useEffect(() => {
    if (roomId || !customerId) return;
    let cancelled = false;
    (async () => {
      try {
        if (!isAuthenticated) {
          const session = await initGuestSession({
            customer_name: customerName,
            customer_email: guestInfo?.email,
          });
          if (cancelled) return;
          setRoomId(session.room_id);
          setIsNewRoom(false);
          if (guestInfo && guestInfo.id !== session.guest_id) {
            setGuestInfo({ ...guestInfo, id: session.guest_id });
            localStorage.setItem("live_chat_guest_id", session.guest_id);
          }
        } else {
          const room = await findOrCreateRoom({
            id: customerId,
            name: customerName,
            email: user?.email,
          });
          if (cancelled) return;
          setRoomId(room.id);
          setIsNewRoom(room.last_message === null);
        }
      } catch (e) {
        if (!cancelled) setInitError(e instanceof Error ? e.message : "Không thể khởi tạo chat");
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId, isAuthenticated]);

  const { messages, sendMessage, uploadAttachment, markAsRead, isLoading, isSending } =
    useLiveChatMessages(roomId, {
      pollMs: !isAuthenticated ? 2500 : undefined,
    });

  useLiveChatBot({ roomId, messages, enabled: true, isNewRoom });

  const { startTyping, typingText } = useLiveChatTyping(roomId, {
    userId: customerId,
    userName: customerName,
    userType: "customer",
  });

  // Mark as read
  useEffect(() => {
    if (roomId && messages.length > 0) markAsRead("support");
  }, [roomId, messages.length, markAsRead]);

  const [input, setInput] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Focus + scroll bottom
  useEffect(() => { textareaRef.current?.focus(); }, [roomId]);
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, typingText]);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) { alert("File quá lớn (tối đa 10MB)"); return; }
    setSelectedFile(f);
    if (f.type.startsWith("image/")) setPreviewUrl(URL.createObjectURL(f));
  };

  const clearFile = () => {
    setSelectedFile(null);
    if (previewUrl) { URL.revokeObjectURL(previewUrl); setPreviewUrl(""); }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const text = input.trim();
    if ((!text && !selectedFile) || !roomId || isSending) return;
    try {
      let attachment;
      if (selectedFile) {
        setUploading(true);
        attachment = await uploadAttachment(selectedFile);
      }
      sendMessage({
        room_id: roomId,
        sender_type: "customer",
        sender_id: customerId,
        sender_name: customerName,
        message: text,
        attachment_url: attachment?.url,
        attachment_type: attachment?.type,
        attachment_name: attachment?.name,
      });
      setInput("");
      clearFile();
    } finally {
      setUploading(false);
    }
  };

  const statusText = useMemo(() => {
    if (hasOnlineAgent) return "Đang trực tuyến";
    return "Sẽ phản hồi sớm";
  }, [hasOnlineAgent]);

  return (
    <div className="light flex h-[100dvh] flex-col bg-white text-slate-900">
      {/* Header */}
      <header className="bg-slate-900 text-white shadow-sm">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-3 px-4 py-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="h-9 w-9 text-white hover:bg-white/10"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/20">
            <img src={stLogo} alt="ST Engineering" className="h-7 w-7 object-contain" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-semibold leading-tight">ST Engineering Support</h1>
            <p className="truncate text-xs text-white/70">
              Trợ lý nội bộ • Defence • Aerospace • Smart City • Digital
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setInput("");
              clearFile();
              scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
              textareaRef.current?.focus();
            }}
            className="hidden h-9 gap-2 text-white/90 hover:bg-white/10 hover:text-white sm:inline-flex"
          >
            <RefreshCcw className="h-3.5 w-3.5" />
            <span className="text-xs font-medium">Cuộc trò chuyện mới</span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setInput("");
              clearFile();
              scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className="h-9 w-9 text-white hover:bg-white/10 sm:hidden"
            aria-label="Cuộc trò chuyện mới"
          >
            <RefreshCcw className="h-4 w-4" />
          </Button>
        </div>
        <div className="mx-auto -mt-1 flex w-full max-w-3xl items-center gap-1.5 px-4 pb-2 text-[11px] text-white/60">
          <span className={cn(
            "inline-block h-1.5 w-1.5 rounded-full",
            hasOnlineAgent ? "bg-emerald-400" : "bg-amber-400"
          )} />
          {statusText}
        </div>
      </header>

      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-4 py-6">
          {initError ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {initError}
            </div>
          ) : isLoading && messages.length === 0 ? (
            <div className="flex items-center justify-center py-20 text-sm text-slate-500">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Đang kết nối...
            </div>
          ) : messages.length === 0 ? (
            <EmptyState onPick={(q) => {
              setInput(q);
              textareaRef.current?.focus();
            }} />
          ) : (
            <div className="space-y-5">
              {messages.map((m) => (
                <MessageRow key={m.id} message={m} currentUserId={customerId} />
              ))}
              {typingText && (
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="flex gap-1">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: "0ms" }} />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: "120ms" }} />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: "240ms" }} />
                  </span>
                  Hỗ trợ viên đang nhập...
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Composer */}
      <div className="border-t border-slate-200 bg-white">
        <form onSubmit={handleSubmit} className="mx-auto w-full max-w-3xl px-4 py-3">
          {selectedFile && (
            <div className="mb-2 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
              {previewUrl ? (
                <img src={previewUrl} alt="" className="h-12 w-12 rounded object-cover" />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded bg-white">
                  <FileText className="h-5 w-5 text-slate-400" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-slate-700">{selectedFile.name}</p>
                <p className="text-[11px] text-slate-500">{(selectedFile.size / 1024).toFixed(1)} KB</p>
              </div>
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={clearFile}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm focus-within:border-slate-400 focus-within:ring-2 focus-within:ring-slate-200">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
              onChange={handleFile}
              className="hidden"
            />
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => { setInput(e.target.value); startTyping(e.target.value); }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void handleSubmit();
                }
              }}
              placeholder="Hỏi về sản phẩm, dịch vụ, tin tức hoặc sự kiện của ST Engineering..."
              rows={1}
              className="min-h-[44px] resize-none border-0 bg-transparent px-2 text-sm text-slate-900 placeholder:text-slate-400 shadow-none focus-visible:ring-0"
              disabled={!roomId}
            />
            <div className="mt-1 flex items-center justify-between gap-1 px-1">
              <div className="flex items-center gap-0.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                  onClick={() => setInput("")}
                  disabled={!input}
                  title="Soạn lại"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                  onClick={() => setInput((v) => v + "\n")}
                  title="Định dạng văn bản"
                >
                  <Type className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={!roomId || uploading}
                  title="Đính kèm tệp"
                >
                  <Paperclip className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                  disabled
                  title="Nhập bằng giọng nói (sắp có)"
                >
                  <Mic className="h-4 w-4" />
                </Button>
              </div>
              <Button
                type="submit"
                size="icon"
                className="h-9 w-9 shrink-0 bg-slate-900 text-white hover:bg-slate-800"
                disabled={!roomId || uploading || isSending || (!input.trim() && !selectedFile)}
              >
                {uploading || isSending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
          <p className="mt-2 text-center text-[11px] text-slate-400">
            Hỗ trợ viên của ST Engineering sẽ phản hồi trong thời gian sớm nhất.
          </p>
        </form>
      </div>
    </div>
  );
}

function MessageRow({ message, currentUserId }: { message: LiveChatMessage; currentUserId: string }) {
  const isOwn = message.sender_id === currentUserId && message.sender_type === "customer";
  const isSupport = message.sender_type === "support" || message.sender_type === "bot";

  return (
    <div className={cn("flex gap-3", isOwn && "justify-end")}>
      {!isOwn && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white">
          <img src={stLogo} alt="ST" className="h-5 w-5 object-contain" />
        </div>
      )}
      <div className={cn("flex max-w-[80%] flex-col", isOwn && "items-end")}>
        {!isOwn && (
          <p className="mb-1 text-[11px] font-medium text-slate-500">
            {isSupport ? "ST Engineering Support" : message.sender_name}
          </p>
        )}
        <div
          className={cn(
            "rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
            isOwn
              ? "rounded-br-md bg-slate-900 text-white"
              : "rounded-bl-md bg-slate-100 text-slate-900"
          )}
        >
          {message.message && (
            <p className="whitespace-pre-wrap break-words">{message.message}</p>
          )}
          {message.attachment_url && (
            <SupportAttachment
              url={message.attachment_url}
              name={message.attachment_name}
              type={message.attachment_type}
              isOwn={isOwn}
            />
          )}
        </div>
        <p className="mt-1 text-[10px] text-slate-400">
          {format(new Date(message.created_at), "HH:mm", { locale: vi })}
        </p>
      </div>
    </div>
  );
}

function EmptyState({ onPick }: { onPick: (q: string) => void }) {
  return (
    <div className="flex flex-col items-center text-center py-6">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-lg">
        <Bot className="h-8 w-8" />
      </div>
      <h2 className="text-xl font-semibold text-slate-900">Xin chào! Tôi có thể giúp gì?</h2>
      <p className="mt-1 max-w-md text-sm text-slate-500">
        Đặt câu hỏi về sản phẩm, dịch vụ, giao dịch hoặc bất cứ điều gì bạn cần hỗ trợ.
      </p>
      <div className="mt-6 grid w-full max-w-xl grid-cols-1 gap-2 sm:grid-cols-2">
        {SUGGESTED_QUESTIONS.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => onPick(q)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-left text-sm text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}