import { useState, useEffect, useCallback } from "react";
import {
  MessageCircle,
  Users,
  Search,
  RefreshCw,
  Bell,
  BellOff,
  StickyNote,
  Plus,
  Edit2,
  Trash2,
  X,
  Check,
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

export default function AdminLiveChat() {
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
    }
  }, [selectedRoom, messages.length, markAsRead]);

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

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-background">
      {/* Sidebar - Room List */}
      <div className="w-80 border-r flex flex-col">
        {/* Header */}
        <div className="p-4 border-b space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <h2 className="font-semibold">Phòng chat</h2>
              {totalUnread > 0 && (
                <Badge variant="destructive" className="h-5 px-1.5">
                  {totalUnread}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() =>
                  notificationEnabled
                    ? setNotificationEnabled(false)
                    : requestNotification()
                }
                title={notificationEnabled ? "Tắt thông báo" : "Bật thông báo"}
              >
                {notificationEnabled ? (
                  <Bell className="h-4 w-4 text-primary" />
                ) : (
                  <BellOff className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => refetchRooms()}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm..."
              className="pl-9"
            />
          </div>
        </div>

        {/* Room list */}
        <ScrollArea className="flex-1">
          {roomsLoading ? (
            <div className="p-4 text-center text-muted-foreground">
              Đang tải...
            </div>
          ) : filteredRooms.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              Không có phòng chat nào
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {filteredRooms.map((room) => (
                <button
                  key={room.id}
                  onClick={() => setSelectedRoom(room)}
                  className={cn(
                    "w-full p-3 rounded-lg text-left transition-colors",
                    selectedRoom?.id === room.id
                      ? "bg-primary/10"
                      : "hover:bg-muted"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback>
                        {room.customer_name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="font-medium truncate">
                          {room.customer_name}
                        </p>
                        {room.unread_count && room.unread_count > 0 && (
                          <Badge
                            variant="destructive"
                            className="h-5 min-w-5 px-1.5 text-xs"
                          >
                            {room.unread_count}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {room.last_message || "Chưa có tin nhắn"}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span
                          className={cn(
                            "h-2 w-2 rounded-full",
                            getStatusColor(room.status)
                          )}
                        />
                        <span className="text-xs text-muted-foreground">
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
      <div className="flex-1 flex flex-col">
        {selectedRoom ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarFallback>
                    {selectedRoom.customer_name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{selectedRoom.customer_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedRoom.customer_email || "Khách"}
                  </p>
                </div>
                <Badge variant="outline" className="ml-2">
                  {getStatusText(selectedRoom.status)}
                </Badge>
              </div>

              <div className="flex items-center gap-2">
                {/* Notes button */}
                <Sheet open={showNotes} onOpenChange={setShowNotes}>
                  <SheetTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      <StickyNote className="h-4 w-4" />
                      Ghi chú
                      {notes.length > 0 && (
                        <Badge variant="secondary">{notes.length}</Badge>
                      )}
                    </Button>
                  </SheetTrigger>
                  <SheetContent>
                    <SheetHeader>
                      <SheetTitle className="flex items-center gap-2">
                        <StickyNote className="h-5 w-5" />
                        Ghi chú nội bộ
                      </SheetTitle>
                    </SheetHeader>

                    <div className="mt-4 space-y-4">
                      {/* Add note form */}
                      <div className="space-y-2">
                        <Textarea
                          value={noteContent}
                          onChange={(e) => setNoteContent(e.target.value)}
                          placeholder="Thêm ghi chú..."
                          rows={3}
                        />
                        <div className="flex justify-end gap-2">
                          {editingNote && (
                            <Button
                              variant="ghost"
                              size="sm"
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
                            onClick={handleSaveNote}
                            disabled={!noteContent.trim() || noteSaving}
                          >
                            {editingNote ? "Cập nhật" : "Lưu"}
                          </Button>
                        </div>
                      </div>

                      {/* Notes list */}
                      <ScrollArea className="h-[calc(100vh-280px)]">
                        <div className="space-y-3">
                          {notes.map((note) => (
                            <Card key={note.id} className="p-3">
                              <p className="text-sm whitespace-pre-wrap">
                                {note.content}
                              </p>
                              <div className="flex items-center justify-between mt-2 pt-2 border-t">
                                <div className="text-xs text-muted-foreground">
                                  {note.author_name} •{" "}
                                  {format(new Date(note.created_at), "dd/MM HH:mm", {
                                    locale: vi,
                                  })}
                                </div>
                                <div className="flex gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={() => {
                                      setEditingNote(note);
                                      setNoteContent(note.content);
                                    }}
                                  >
                                    <Edit2 className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-destructive"
                                    onClick={() => deleteNote(note.id)}
                                  >
                                    <Trash2 className="h-3 w-3" />
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

                {/* Status actions */}
                {selectedRoom.status !== "closed" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      updateRoom({ id: selectedRoom.id, status: "closed" })
                    }
                  >
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                    Đóng
                  </Button>
                )}
              </div>
            </div>

            {/* Messages */}
            <MessageList
              messages={messages}
              currentUserId={user?.id || ""}
              typingText={typingText}
              isLoading={messagesLoading}
            />

            {/* Quick Replies */}
            <div className="px-4 py-2 border-t bg-muted/30">
              <ScrollArea className="w-full">
                <div className="flex gap-2">
                  {QUICK_REPLIES.map((reply, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      size="sm"
                      className="whitespace-nowrap text-xs"
                      onClick={() => handleQuickReply(reply)}
                    >
                      {reply.length > 30 ? reply.slice(0, 30) + "..." : reply}
                    </Button>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {/* Message Input */}
            <MessageInput
              onSend={handleSend}
              onTyping={startTyping}
              onUpload={uploadAttachment}
              disabled={isSending || selectedRoom.status === "closed"}
              placeholder={
                selectedRoom.status === "closed"
                  ? "Phòng chat đã đóng"
                  : "Nhập tin nhắn..."
              }
            />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Chọn một phòng chat để bắt đầu</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
