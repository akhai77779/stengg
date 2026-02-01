import { useState, useEffect, useCallback, useRef } from "react";
import { MessageCircle, X, Minimize2, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useLiveChatMessages } from "@/hooks/useLiveChatMessages";
import { useLiveChatTyping } from "@/hooks/useLiveChatTyping";
import { useLiveChatRooms } from "@/hooks/useLiveChatRooms";
import { useLiveChatSession } from "@/hooks/useLiveChatSession";
import { useLiveChatBot, isWithinWorkingHours, BOT_CONFIG } from "@/hooks/useLiveChatBot";
import { useAuth } from "@/hooks/useAuth";
import { MessageList, MessageInput } from "./MessageComponents";

interface ChatWidgetProps {
  position?: "bottom-right" | "bottom-left";
  defaultOpen?: boolean;
}

export function ChatWidget({
  position = "bottom-right",
  defaultOpen = false,
}: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [isMinimized, setIsMinimized] = useState(false);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [isNewRoom, setIsNewRoom] = useState(false);
  const [guestInfo, setGuestInfo] = useState<{
    id: string;
    name: string;
    email?: string;
  } | null>(null);

  const { user } = useAuth();
  const isAuthenticated = !!user;
  const { findOrCreateRoom } = useLiveChatRooms();
  const lastActivityRef = useRef<number>(Date.now());

  // Get or create customer info
  const customerId = user?.id || guestInfo?.id || "";
  const customerName = user?.email?.split("@")[0] || guestInfo?.name || "Khách";

  const {
    messages,
    sendMessage,
    uploadAttachment,
    markAsRead,
    isLoading,
    isSending,
  } = useLiveChatMessages(roomId, {
    onNewMessage: (msg) => {
      // Play sound for support messages
      if (msg.sender_type === "support" || msg.sender_type === "bot") {
        playNotificationSound();
      }
      // Record activity on new message
      lastActivityRef.current = Date.now();
    },
  });

  // Session management
  const {
    isSessionActive,
    handleUserActivity,
    resetSessionTimeout,
  } = useLiveChatSession({
    roomId,
    customerId,
    customerName,
    onSessionClosed: () => {
      console.log("Session closed due to inactivity");
    },
    onSessionResumed: () => {
      console.log("Session resumed");
    },
  });

  // Bot automation
  const {
    isWithinWorkingHours: isWorkingHours,
  } = useLiveChatBot({
    roomId,
    messages,
    enabled: true,
    isNewRoom,
  });

  const { startTyping, typingText } = useLiveChatTyping(roomId, {
    userId: customerId,
    userName: customerName,
    userType: "customer",
  });

  // Initialize room when widget opens
  useEffect(() => {
    if (isOpen && !roomId && (isAuthenticated || guestInfo)) {
      initRoom();
    }
  }, [isOpen, roomId, isAuthenticated, guestInfo]);

  // Mark messages as read when viewing
  useEffect(() => {
    if (isOpen && roomId && messages.length > 0) {
      markAsRead("support");
    }
  }, [isOpen, roomId, messages.length, markAsRead]);

  const initRoom = async () => {
    if (!customerId) return;

    try {
      const room = await findOrCreateRoom({
        id: customerId,
        name: customerName,
        email: user?.email || guestInfo?.email,
      });
      
      // Check if this is a new room (no messages yet)
      setIsNewRoom(room.last_message === null);
      setRoomId(room.id);
    } catch (error) {
      console.error("Error initializing room:", error);
    }
  };

  // Generate guest ID
  const generateGuestId = () => {
    let guestId = localStorage.getItem("live_chat_guest_id");
    if (!guestId) {
      guestId = `guest_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      localStorage.setItem("live_chat_guest_id", guestId);
    }
    return guestId;
  };

  // Handle widget open
  const handleOpen = () => {
    if (!isAuthenticated && !guestInfo) {
      // For guests, auto-generate info
      const guestId = generateGuestId();
      setGuestInfo({
        id: guestId,
        name: `Khách #${guestId.slice(-4)}`,
      });
    }
    setIsOpen(true);
    setIsMinimized(false);
    handleUserActivity();
  };

  // Handle send message
  const handleSend = async (
    message: string,
    attachment?: { url: string; type: "image" | "file"; name: string }
  ) => {
    if (!roomId) return;

    // Reset session timeout on send
    handleUserActivity();

    sendMessage({
      room_id: roomId,
      sender_type: "customer",
      sender_id: customerId,
      sender_name: customerName,
      message,
      attachment_url: attachment?.url,
      attachment_type: attachment?.type,
      attachment_name: attachment?.name,
    });
  };

  // Handle typing - also reset session timeout
  const handleTyping = useCallback((text?: string) => {
    startTyping(text);
    handleUserActivity();
  }, [startTyping, handleUserActivity]);

  // Notification sound
  const playNotificationSound = useCallback(() => {
    try {
      const audioContext = new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext)();

      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator.type = "sine";

      gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(
        0.01,
        audioContext.currentTime + 0.3
      );

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    } catch (error) {
      console.warn("Could not play notification sound:", error);
    }
  }, []);

  // Unread count from support
  const unreadCount = messages.filter(
    (m) => (m.sender_type === "support" || m.sender_type === "bot") && !m.is_read
  ).length;

  const positionClasses =
    position === "bottom-right" ? "right-4" : "left-4";

  // Working hours indicator
  const workingHoursText = isWorkingHours
    ? "Đang trực tuyến"
    : `Ngoài giờ làm việc (${BOT_CONFIG.WORKING_HOURS_START}:00-${BOT_CONFIG.WORKING_HOURS_END}:00)`;

  return (
    <>
      {/* Floating button - hidden on mobile, use SupportMenuButton instead */}
      {!isOpen && (
        <Button
          onClick={handleOpen}
          size="lg"
          className={cn(
            "fixed bottom-4 z-50 rounded-full h-14 w-14 shadow-lg hidden md:flex",
            positionClasses
          )}
        >
          <MessageCircle className="h-6 w-6" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 min-w-5 px-1.5 text-xs"
            >
              {unreadCount}
            </Badge>
          )}
        </Button>
      )}

      {/* Chat window */}
      {isOpen && (
        <Card
          className={cn(
            "fixed bottom-4 z-50 shadow-2xl overflow-hidden flex flex-col",
            positionClasses,
            isMinimized
              ? "w-72 h-14"
              : "w-[360px] h-[500px] sm:w-[400px] sm:h-[550px]"
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-3 bg-primary text-primary-foreground">
            <div className="flex items-center gap-2">
              <div className="relative">
                <MessageCircle className="h-5 w-5" />
                <span 
                  className={cn(
                    "absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-primary-foreground",
                    isWorkingHours ? "bg-green-400" : "bg-yellow-400"
                  )}
                />
              </div>
              <div className="flex flex-col">
                <span className="font-medium text-sm">
                  {isMinimized ? "Hỗ trợ trực tuyến" : "Chat với chúng tôi"}
                </span>
                {!isMinimized && (
                  <span className="text-xs opacity-80">
                    {workingHoursText}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 hover:bg-primary-foreground/20"
                onClick={() => setIsMinimized(!isMinimized)}
              >
                {isMinimized ? (
                  <Maximize2 className="h-4 w-4" />
                ) : (
                  <Minimize2 className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 hover:bg-primary-foreground/20"
                onClick={() => setIsOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Content */}
          {!isMinimized && (
            <>
              <MessageList
                messages={messages}
                currentUserId={customerId}
                typingText={typingText}
                isLoading={isLoading}
              />

              <MessageInput
                onSend={handleSend}
                onTyping={handleTyping}
                onUpload={uploadAttachment}
                disabled={isSending || !roomId}
                placeholder="Nhập tin nhắn..."
              />
            </>
          )}
        </Card>
      )}
    </>
  );
}
