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
  Bot,
  BarChart3,
  Timer,
  Download,
  FileText,
  FileSpreadsheet,
  PanelRight,
  PanelRightClose,
} from "lucide-react";
import { Inbox, XCircle, MessageSquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
// ScrollArea removed - using native scrolling for better flexbox compatibility
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";
import { useAuth } from "@/hooks/useAuth";
import { useLiveChatRooms, LiveChatRoom } from "@/hooks/useLiveChatRooms";
import { useLiveChatMessages, LiveChatMessage } from "@/hooks/useLiveChatMessages";
import { useLiveChatTyping } from "@/hooks/useLiveChatTyping";
import { useLiveChatNotes, LiveChatNote } from "@/hooks/useLiveChatNotes";
import { useRoomChatStats, useGlobalChatStats } from "@/hooks/useLiveChatStats";
import { useLiveChatBot } from "@/hooks/useLiveChatBot";
import { MessageList } from "@/components/live-chat/MessageComponents";
import { ChatInputWithExtras } from "./ChatInputWithExtras";
import { CustomerInfoPanel } from "./CustomerInfoPanel";
import { exportChatToCSV, exportChatToPDF } from "@/lib/exportLiveChatHistory";
import { useToast } from "@/hooks/use-toast";

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
  const [botEnabled, setBotEnabled] = useState(true);
  const [showStats, setShowStats] = useState(false);
  const [showCustomerInfo, setShowCustomerInfo] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "closed">("all");
  const [newMessageRoomId, setNewMessageRoomId] = useState<string | null>(null);

  const { user } = useAuth();
  const { toast } = useToast();
  const { rooms, isLoading: roomsLoading, refetch: refetchRooms, updateRoom, totalUnread } = useLiveChatRooms();

  const {
    messages,
    sendMessage,
    editMessage,
    deleteMessage,
    uploadAttachment,
    markAsRead,
    isLoading: messagesLoading,
    isSending,
  } = useLiveChatMessages(selectedRoom?.id || null, {
    onNewMessage: (msg) => {
      if (msg.sender_type === "customer") {
        playNotificationSound();
        showNotification(msg);
        // Flash the room in sidebar even if filtered
        setNewMessageRoomId(msg.room_id);
        setTimeout(() => setNewMessageRoomId(null), 3000);
      }
    },
  });

  const { startTyping, typingText, typingPreview } = useLiveChatTyping(selectedRoom?.id || null, {
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

  // Stats hooks
  const roomStats = useRoomChatStats(messages);
  const globalStats = useGlobalChatStats(rooms);

  // Bot hook
  useLiveChatBot({
    roomId: selectedRoom?.id || null,
    messages,
    enabled: botEnabled,
  });

  // Filter rooms by search
  const searchFilteredRooms = rooms.filter(
    (room) =>
      room.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      room.customer_email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      room.last_message?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Apply status filter
  const filteredRooms = searchFilteredRooms.filter((room) => {
    if (statusFilter === "all") return true;
    if (statusFilter === "active") return room.status !== "closed";
    if (statusFilter === "closed") return room.status === "closed";
    return true;
  });

  // Count rooms with new messages that are filtered out
  const hasNewMessageOutsideFilter = newMessageRoomId && !filteredRooms.some(r => r.id === newMessageRoomId);
  const newMessageRoom = hasNewMessageOutsideFilter ? rooms.find(r => r.id === newMessageRoomId) : null;

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

  // Notification sound - always plays regardless of desktop notification setting
  const playNotificationSound = useCallback(() => {
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
  }, []);

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

  // Send Telegram notification for new customer messages
  const sendTelegramNotification = useCallback(async (senderName: string, message: string, roomId: string) => {
    try {
      await supabase.functions.invoke("telegram-notify", {
        body: { sender_name: senderName, message: message || "Tệp đính kèm", room_id: roomId },
      });
    } catch (err) {
      console.warn("Telegram notification failed:", err);
    }
  }, []);

  // Global realtime subscription for ALL new customer messages (not just selected room)
  useEffect(() => {
    const channel = supabase
      .channel("admin-global-messages")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "live_chat_messages",
        },
        (payload) => {
          const newMsg = payload.new as { room_id: string; sender_type: string; sender_name: string; message: string };
          
          // Only notify for customer messages
          if (newMsg.sender_type === "customer") {
            // Always play sound for new customer messages
            playNotificationSound();
            
            // Send Telegram notification
            sendTelegramNotification(newMsg.sender_name, newMsg.message, newMsg.room_id);

            // If this room is NOT currently selected, show desktop notification
            if (newMsg.room_id !== selectedRoom?.id) {
              // Find room info for notification
              const msgRoom = rooms.find(r => r.id === newMsg.room_id);
              if (msgRoom && notificationEnabled && Notification.permission === "granted") {
                const notification = new Notification("Tin nhắn mới từ khách hàng", {
                  body: `${newMsg.sender_name}: ${newMsg.message || "Tệp đính kèm"}`,
                  icon: "/favicon.ico",
                  tag: `chat-${newMsg.room_id}`,
                });
                notification.onclick = () => {
                  window.focus();
                  setSelectedRoom(msgRoom);
                  setStatusFilter("all");
                  notification.close();
                };
                setTimeout(() => notification.close(), 5000);
              }
              
              // Flash new message indicator
              setNewMessageRoomId(newMsg.room_id);
              setTimeout(() => setNewMessageRoomId(null), 3000);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedRoom?.id, rooms, notificationEnabled, playNotificationSound, sendTelegramNotification]);

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
      sender_name: "Support ST Engineering",
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
      sender_name: "Support ST Engineering",
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

  // Export handlers
  const handleExportCSV = () => {
    if (!selectedRoom || messages.length === 0) {
      toast({
        title: "Không có dữ liệu",
        description: "Không có tin nhắn để xuất",
        variant: "destructive",
      });
      return;
    }

    exportChatToCSV(messages, {
      id: selectedRoom.id,
      customer_name: selectedRoom.customer_name,
      customer_email: selectedRoom.customer_email,
      status: selectedRoom.status,
      created_at: selectedRoom.created_at,
    });

    toast({
      title: "Xuất CSV thành công",
      description: `Đã xuất ${messages.length} tin nhắn`,
    });
  };

  const handleExportPDF = () => {
    if (!selectedRoom || messages.length === 0) {
      toast({
        title: "Không có dữ liệu",
        description: "Không có tin nhắn để xuất",
        variant: "destructive",
      });
      return;
    }

    exportChatToPDF(messages, {
      id: selectedRoom.id,
      customer_name: selectedRoom.customer_name,
      customer_email: selectedRoom.customer_email,
      status: selectedRoom.status,
      created_at: selectedRoom.created_at,
    });

    toast({
      title: "Xuất PDF thành công",
      description: `Đã xuất ${messages.length} tin nhắn`,
    });
  };

  const containerHeight = isEmbedded ? "h-full" : "h-[calc(100vh-4rem)]";
  const sidebarWidth = isEmbedded ? "w-64" : "w-80";

  // Mobile: toggle between room list and chat view
  const showRoomListOnMobile = !selectedRoom;

  return (
    <TooltipProvider>
    <div className={cn("flex bg-background", containerHeight)}>
      {/* Sidebar - Room List */}
      <div className={cn(
        "border-r flex flex-col",
        sidebarWidth,
        // Mobile: full width when showing room list, hidden when showing chat
        "max-md:absolute max-md:inset-0 max-md:w-full max-md:z-10 max-md:bg-background",
        !showRoomListOnMobile && "max-md:hidden"
      )}>
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
              {/* Bot Toggle */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={botEnabled ? "default" : "ghost"}
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setBotEnabled(!botEnabled)}
                  >
                    <Bot className={cn("h-3.5 w-3.5", botEnabled ? "" : "text-muted-foreground")} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{botEnabled ? "Bot tự động: BẬT" : "Bot tự động: TẮT"}</p>
                </TooltipContent>
              </Tooltip>
              
              {/* Stats Toggle */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={showStats ? "default" : "ghost"}
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setShowStats(!showStats)}
                  >
                    <BarChart3 className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Thống kê</p>
                </TooltipContent>
              </Tooltip>

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

          {/* Stats Panel */}
          {showStats && (
            <Card className="p-2 bg-muted/50">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-green-500" />
                  <span className="text-muted-foreground">Hoạt động:</span>
                  <span className="font-medium">{globalStats.activeRooms}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-yellow-500" />
                  <span className="text-muted-foreground">Chờ:</span>
                  <span className="font-medium">{globalStats.waitingRooms}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-gray-500" />
                  <span className="text-muted-foreground">Đóng:</span>
                  <span className="font-medium">{globalStats.closedRooms}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Timer className="h-3 w-3 text-muted-foreground" />
                  <span className="text-muted-foreground">Tổng:</span>
                  <span className="font-medium">{globalStats.totalRooms}</span>
                </div>
              </div>
            </Card>
          )}

          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm..."
              className="pl-8 h-8 text-sm"
            />
          </div>

          {/* Status Filter Tabs */}
          <div className="flex gap-1">
            <Button
              variant={statusFilter === "all" ? "default" : "ghost"}
              size="sm"
              className="flex-1 h-7 text-xs gap-1"
              onClick={() => setStatusFilter("all")}
            >
              <Inbox className="h-3 w-3" />
              Tất cả
              {totalUnread > 0 && (
                <Badge variant="destructive" className="h-4 px-1 text-[10px] ml-0.5">
                  {totalUnread}
                </Badge>
              )}
            </Button>
            <Button
              variant={statusFilter === "active" ? "default" : "ghost"}
              size="sm"
              className="flex-1 h-7 text-xs gap-1"
              onClick={() => setStatusFilter("active")}
            >
              <CheckCircle2 className="h-3 w-3" />
              Active
            </Button>
            <Button
              variant={statusFilter === "closed" ? "default" : "ghost"}
              size="sm"
              className="flex-1 h-7 text-xs gap-1"
              onClick={() => setStatusFilter("closed")}
            >
              <XCircle className="h-3 w-3" />
              Đóng
            </Button>
          </div>
        </div>

        {/* Room list */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
          {/* New message notification banner - shows when new message is in filtered-out room */}
          {newMessageRoom && (
            <div 
              className="mx-1.5 mt-1.5 p-2 bg-destructive/20 border border-destructive/50 rounded-lg cursor-pointer animate-pulse"
              onClick={() => {
                setStatusFilter("all");
                setSelectedRoom(newMessageRoom);
                setNewMessageRoomId(null);
              }}
            >
              <div className="flex items-center gap-2">
                <MessageSquarePlus className="h-4 w-4 text-destructive shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-destructive truncate">
                    Tin nhắn mới từ {newMessageRoom.customer_name}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Nhấn để xem
                  </p>
                </div>
              </div>
            </div>
          )}

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
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex min-w-0">
        {/* Chat Column */}
        <div className="flex-1 flex flex-col min-w-0">
          {selectedRoom ? (
            <>
              {/* Chat Header */}
              <div className="p-3 border-b">
                <div className="flex items-center justify-between">
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

                    {/* Export dropdown */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="h-7 px-2 gap-1">
                          <Download className="h-3 w-3" />
                          <span className="text-xs">Xuất</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={handleExportCSV} className="gap-2 cursor-pointer">
                          <FileSpreadsheet className="h-4 w-4" />
                          Xuất CSV
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={handleExportPDF} className="gap-2 cursor-pointer">
                          <FileText className="h-4 w-4" />
                          Xuất PDF
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Customer Info Toggle */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant={showCustomerInfo ? "default" : "outline"}
                          size="sm"
                          className="h-7 px-2"
                          onClick={() => setShowCustomerInfo(!showCustomerInfo)}
                        >
                          {showCustomerInfo ? (
                            <PanelRightClose className="h-3 w-3" />
                          ) : (
                            <PanelRight className="h-3 w-3" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{showCustomerInfo ? "Ẩn thông tin khách" : "Hiện thông tin khách"}</p>
                      </TooltipContent>
                    </Tooltip>

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
                          <div className="h-[calc(100vh-280px)] overflow-y-auto overscroll-contain">
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
                          </div>
                        </div>
                      </SheetContent>
                    </Sheet>
                  </div>
                </div>
              </div>
              
              {/* Room Stats Bar */}
              {showStats && messages.length > 0 && (
                <div className="px-3 py-1.5 border-b bg-muted/30">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1.5">
                        <Timer className="h-3 w-3 text-primary" />
                        <span className="text-muted-foreground">TB phản hồi:</span>
                        <span className="font-medium text-primary">{roomStats.avgResponseTimeText}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground">Tin nhắn:</span>
                        <span className="font-medium">{roomStats.totalMessages}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground">Tỷ lệ:</span>
                        <span className="font-medium">{roomStats.responseRate}%</span>
                      </div>
                    </div>
                    {botEnabled && (
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Bot className="h-3 w-3" />
                        <span>Bot: BẬT</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Messages */}
              <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                <MessageList
                  messages={messages}
                  isLoading={messagesLoading}
                  typingText={typingText}
                  currentUserId={user?.id || ""}
                  canModifyMessages={true}
                  onEditMessage={(messageId, newMessage) => editMessage({ messageId, newMessage })}
                  onDeleteMessage={(messageId) => deleteMessage(messageId)}
                />
              </div>

              {/* Message Input with Extras */}
              <div className="p-3 border-t">
                <ChatInputWithExtras
                  onSend={handleSend}
                  onTyping={startTyping}
                  onUpload={uploadAttachment}
                  disabled={isSending}
                  placeholder="Nhập tin nhắn..."
                   isAdmin={true}
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

        {/* Customer Info Panel */}
        {selectedRoom && showCustomerInfo && (
          <CustomerInfoPanel
            room={selectedRoom}
            messages={messages}
            className="w-64 hidden lg:block"
            typingPreview={typingPreview}
            botEnabled={botEnabled}
            onClose={() => setShowCustomerInfo(false)}
          />
        )}
      </div>
    </div>
    </TooltipProvider>
  );
}
