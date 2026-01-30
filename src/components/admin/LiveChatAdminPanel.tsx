import { useState, useEffect, useCallback } from "react";
import {
  Users,
  Search,
  RefreshCw,
  Bell,
  BellOff,
  StickyNote,
  Edit2,
  Trash2,
  Clock,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";
import { useAuth } from "@/hooks/useAuth";
import { useLiveChatRooms, LiveChatRoom } from "@/hooks/useLiveChatRooms";
import { useLiveChatMessages, LiveChatMessage } from "@/hooks/useLiveChatMessages";
import { useLiveChatTyping } from "@/hooks/useLiveChatTyping";
import { useLiveChatNotes, LiveChatNote } from "@/hooks/useLiveChatNotes";
import { MessageList, MessageInput } from "@/components/live-chat/MessageComponents";

// Quick reply templates
const QUICK_REPLIES = [
  "Xin chào! Tôi có thể giúp gì cho bạn?",
  "Cảm ơn bạn đã liên hệ. Vui lòng chờ trong giây lát.",
  "Vấn đề của bạn đã được ghi nhận. Chúng tôi sẽ phản hồi sớm nhất có thể.",
  "Bạn có thể cung cấp thêm thông tin chi tiết được không?",
  "Cảm ơn bạn đã sử dụng dịch vụ của chúng tôi!",
];

interface LiveChatAdminPanelProps {
  isEmbedded?: boolean;
  onClearUnread?: () => void;
}

export function LiveChatAdminPanel({ isEmbedded = false, onClearUnread }: LiveChatAdminPanelProps) {
  const [selectedRoom, setSelectedRoom] = useState<LiveChatRoom | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [notificationEnabled, setNotificationEnabled] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [noteContent, setNoteContent] = useState("");
  const [editingNote, setEditingNote] = useState<LiveChatNote | null>(null);

  const { user } = useAuth();
  const { rooms, isLoading: roomsLoading, refetch: refetchRooms, updateRoom, totalUnread } = useLiveChatRooms();

  const {
    messages,
    sendMessage,
    uploadAttachment,
    markAsRead,
    isLoading: messagesLoading,
    isSending,
  } = useLiveChatMessages(selectedRoom?.id || null, {
    onNewMessage: (msg) => {
      if (msg.sender_type === "customer") {
        playNotificationSound();
        showNotification(msg);
      }
    },
  });

  const { startTyping, typingText } = useLiveChatTyping(selectedRoom?.id || null, {
    userId: user?.id || "",
    userName: user?.email?.split("@")[0] || "Support",
    userType: "support",
  });

  const {
    notes,
    createNote,
    updateNote,
    deleteNote,
    isCreating: noteSaving,
  } = useLiveChatNotes(selectedRoom?.id || null);

  // Filter rooms by search
  const filteredRooms = rooms.filter(
    (room) =>
      room.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      room.customer_email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      room.last_message?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Request notification permission
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "granted") {
      setNotificationEnabled(true);
    }
  }, []);

  const requestNotification = async () => {
    if ("Notification" in window && Notification.permission === "default") {
      const permission = await Notification.requestPermission();
      setNotificationEnabled(permission === "granted");
    } else if (Notification.permission === "granted") {
      setNotificationEnabled(true);
    }
  };

  // Mark messages as read when selecting room
  useEffect(() => {
    if (selectedRoom && messages.length > 0) {
      markAsRead("customer");
      onClearUnread?.();
    }
  }, [selectedRoom, messages.length, markAsRead, onClearUnread]);

  // Notification sound
  const playNotificationSound = useCallback(() => {
    if (!notificationEnabled) return;
    try {
      const audioContext = new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext)();

      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.setValueAtTime(600, audioContext.currentTime);
      oscillator.type = "sine";

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.4);
    } catch (error) {
      console.warn("Could not play notification sound:", error);
    }
  }, [notificationEnabled]);

  // Desktop notification
  const showNotification = useCallback(
    (msg: LiveChatMessage) => {
      if (!notificationEnabled || Notification.permission !== "granted") return;

      const notification = new Notification("Tin nhắn mới từ khách hàng", {
        body: `${msg.sender_name}: ${msg.message || "Tệp đính kèm"}`,
        icon: "/favicon.ico",
        tag: `chat-${msg.room_id}`,
      });

      notification.onclick = () => {
        window.focus();
        const room = rooms.find((r) => r.id === msg.room_id);
        if (room) setSelectedRoom(room);
        notification.close();
      };

      setTimeout(() => notification.close(), 5000);
    },
    [notificationEnabled, rooms]
  );

  // Send message handler
  const handleSend = async (
    message: string,
    attachment?: { url: string; type: "image" | "file"; name: string }
  ) => {
    if (!selectedRoom || !user) return;

    sendMessage({
      room_id: selectedRoom.id,
      sender_type: "support",
      sender_id: user.id,
      sender_name: user.email?.split("@")[0] || "Support",
      message,
      attachment_url: attachment?.url,
      attachment_type: attachment?.type,
      attachment_name: attachment?.name,
    });
  };

  // Quick reply
  const handleQuickReply = (text: string) => {
    if (!selectedRoom || !user) return;

    sendMessage({
      room_id: selectedRoom.id,
      sender_type: "support",
      sender_id: user.id,
      sender_name: user.email?.split("@")[0] || "Support",
      message: text,
    });
  };

  // Room status helpers
  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-500";
      case "waiting":
        return "bg-yellow-500";
      case "closed":
        return "bg-gray-500";
      default:
        return "bg-gray-500";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "active":
        return "Đang hoạt động";
      case "waiting":
        return "Chờ phản hồi";
      case "closed":
        return "Đã đóng";
      default:
        return status;
    }
  };

  // Note handlers
  const handleSaveNote = () => {
    if (!selectedRoom || !user || !noteContent.trim()) return;

    if (editingNote) {
      updateNote({ id: editingNote.id, content: noteContent });
    } else {
      createNote({
        room_id: selectedRoom.id,
        content: noteContent,
        author_id: user.id,
        author_name: user.email?.split("@")[0] || "Support",
        author_email: user.email || undefined,
      });
    }

    setNoteContent("");
    setEditingNote(null);
  };

  // Handle room status change
  const handleStatusChange = (status: "active" | "waiting" | "closed") => {
    if (!selectedRoom) return;
    updateRoom({ id: selectedRoom.id, status });
    setSelectedRoom({ ...selectedRoom, status });
  };

  const containerHeight = isEmbedded ? "h-full" : "h-[calc(100vh-4rem)]";
  const sidebarWidth = isEmbedded ? "w-64" : "w-80";

  return (
    <div className={cn("flex bg-background", containerHeight)}>
      {/* Sidebar - Room List */}
      <div className={cn("border-r flex flex-col", sidebarWidth)}>
        {/* Header */}
        <div className="p-3 border-b space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <h2 className="font-semibold text-sm">Phòng chat</h2>
              {totalUnread > 0 && (
                <Badge variant="destructive" className="h-5 px-1.5 text-xs">
                  {totalUnread}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() =>
                  notificationEnabled
                    ? setNotificationEnabled(false)
                    : requestNotification()
                }
                title={notificationEnabled ? "Tắt thông báo" : "Bật thông báo"}
              >
                {notificationEnabled ? (
                  <Bell className="h-3.5 w-3.5 text-primary" />
                ) : (
                  <BellOff className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => refetchRooms()}
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm..."
              className="pl-8 h-8 text-sm"
            />
          </div>
        </div>

        {/* Room list */}
        <ScrollArea className="flex-1">
          {roomsLoading ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              Đang tải...
            </div>
          ) : filteredRooms.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              Không có phòng chat nào
            </div>
          ) : (
            <div className="p-1.5 space-y-0.5">
              {filteredRooms.map((room) => (
                <button
                  key={room.id}
                  onClick={() => setSelectedRoom(room)}
                  className={cn(
                    "w-full p-2 rounded-lg text-left transition-colors",
                    selectedRoom?.id === room.id
                      ? "bg-primary/10"
                      : "hover:bg-muted"
                  )}
                >
                  <div className="flex items-start gap-2">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs">
                        {room.customer_name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-sm truncate">
                          {room.customer_name}
                        </p>
                        {room.unread_count && room.unread_count > 0 && (
                          <Badge
                            variant="destructive"
                            className="h-4 min-w-4 px-1 text-[10px]"
                          >
                            {room.unread_count}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {room.last_message || "Chưa có tin nhắn"}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span
                          className={cn(
                            "h-1.5 w-1.5 rounded-full",
                            getStatusColor(room.status)
                          )}
                        />
                        <span className="text-[10px] text-muted-foreground">
                          {formatDistanceToNow(new Date(room.last_updated_at), {
                            addSuffix: true,
                            locale: vi,
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedRoom ? (
          <>
            {/* Chat Header */}
            <div className="p-3 border-b flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="text-xs">
                    {selectedRoom.customer_name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium text-sm">{selectedRoom.customer_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {selectedRoom.customer_email || "Khách"}
                  </p>
                </div>
                <Badge variant="outline" className="ml-1 text-xs">
                  {getStatusText(selectedRoom.status)}
                </Badge>
              </div>

              <div className="flex items-center gap-1">
                {/* Status buttons */}
                <Button
                  variant={selectedRoom.status === "active" ? "default" : "outline"}
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => handleStatusChange("active")}
                >
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Active
                </Button>
                <Button
                  variant={selectedRoom.status === "closed" ? "destructive" : "outline"}
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => handleStatusChange("closed")}
                >
                  Đóng
                </Button>

                {/* Notes button */}
                <Sheet open={showNotes} onOpenChange={setShowNotes}>
                  <SheetTrigger asChild>
                    <Button variant="outline" size="sm" className="h-7 px-2 gap-1">
                      <StickyNote className="h-3 w-3" />
                      <span className="text-xs">Ghi chú</span>
                      {notes.length > 0 && (
                        <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                          {notes.length}
                        </Badge>
                      )}
                    </Button>
                  </SheetTrigger>
                  <SheetContent className="w-80">
                    <SheetHeader>
                      <SheetTitle className="flex items-center gap-2 text-sm">
                        <StickyNote className="h-4 w-4" />
                        Ghi chú nội bộ
                      </SheetTitle>
                    </SheetHeader>

                    <div className="mt-4 space-y-3">
                      {/* Add note form */}
                      <div className="space-y-2">
                        <Textarea
                          value={noteContent}
                          onChange={(e) => setNoteContent(e.target.value)}
                          placeholder="Thêm ghi chú..."
                          rows={2}
                          className="text-sm"
                        />
                        <div className="flex justify-end gap-1">
                          {editingNote && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => {
                                setEditingNote(null);
                                setNoteContent("");
                              }}
                            >
                              Hủy
                            </Button>
                          )}
                          <Button
                            size="sm"
                            className="h-7 text-xs"
                            onClick={handleSaveNote}
                            disabled={!noteContent.trim() || noteSaving}
                          >
                            {editingNote ? "Cập nhật" : "Lưu"}
                          </Button>
                        </div>
                      </div>

                      {/* Notes list */}
                      <ScrollArea className="h-[calc(100vh-280px)]">
                        <div className="space-y-2">
                          {notes.map((note) => (
                            <Card key={note.id} className="p-2">
                              <p className="text-xs whitespace-pre-wrap">
                                {note.content}
                              </p>
                              <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t">
                                <div className="text-[10px] text-muted-foreground">
                                  {note.author_name} •{" "}
                                  {format(new Date(note.created_at), "dd/MM HH:mm", {
                                    locale: vi,
                                  })}
                                </div>
                                <div className="flex gap-0.5">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-5 w-5"
                                    onClick={() => {
                                      setEditingNote(note);
                                      setNoteContent(note.content);
                                    }}
                                  >
                                    <Edit2 className="h-2.5 w-2.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-5 w-5 text-destructive"
                                    onClick={() => deleteNote(note.id)}
                                  >
                                    <Trash2 className="h-2.5 w-2.5" />
                                  </Button>
                                </div>
                              </div>
                            </Card>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  </SheetContent>
                </Sheet>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-hidden">
              <MessageList
                messages={messages}
                isLoading={messagesLoading}
                typingText={typingText}
                currentUserId={user?.id}
              />
            </div>

            {/* Quick Replies */}
            <div className="px-3 py-1.5 border-t bg-muted/30">
              <ScrollArea className="w-full">
                <div className="flex gap-1.5 pb-1">
                  {QUICK_REPLIES.map((reply, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      size="sm"
                      className="h-6 px-2 text-[10px] whitespace-nowrap shrink-0"
                      onClick={() => handleQuickReply(reply)}
                    >
                      {reply.slice(0, 30)}...
                    </Button>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {/* Message Input */}
            <div className="p-3 border-t">
              <MessageInput
                onSend={handleSend}
                onTyping={startTyping}
                onUpload={uploadAttachment}
                disabled={isSending}
                placeholder="Nhập tin nhắn..."
              />
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">Chọn một phòng chat để bắt đầu</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
