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
import { useOnlineAgentBadge } from "@/hooks/useAgentPresence";
import { MessageList, MessageInput } from "./MessageComponents";
import { PreChatForm, type PreChatPayload, TOPIC_LABELS } from "./PreChatForm";
import {
  initGuestSession,
  rehydrateGuestHeaders,
  loadGuestSession,
} from "@/lib/guestChatAuth";

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
    topic?: string;
  } | null>(null);
  const [showPreChat, setShowPreChat] = useState(false);
  const [isInitingRoom, setIsInitingRoom] = useState(false);

  const { user } = useAuth();
  const isAuthenticated = !!user;
  const { findOrCreateRoom } = useLiveChatRooms();
  const lastActivityRef = useRef<number>(Date.now());
  const [guestInitError, setGuestInitError] = useState<string | null>(null);
  const { isOnline: hasOnlineAgent } = useOnlineAgentBadge();

  // Get or create customer info
  const customerId = user?.id || guestInfo?.id || "";
  const customerName = user?.email?.split("@")[0] || guestInfo?.name || "Khách";

  const {
    messages,
    sendMessage,
    uploadAttachment,
    markAsRead,
    markDelivered,
    isLoading,
    isSending,
  } = useLiveChatMessages(roomId, {
    onNewMessage: (msg) => {
      // Play sound for support messages
      if (msg.sender_type === "support" || msg.sender_type === "bot") {
        playNotificationSound();
        // Mark as delivered as soon as it arrives client-side
        markDelivered?.(["support", "bot"]);
      }
      // Record activity on new message
      lastActivityRef.current = Date.now();
    },
    pollMs: !isAuthenticated ? 2500 : undefined,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, roomId, isAuthenticated, guestInfo]);

  // Re-apply guest headers from localStorage on mount so realtime/queries pass RLS.
  useEffect(() => {
    if (!isAuthenticated) rehydrateGuestHeaders();
  }, [isAuthenticated]);

  // Mark messages as read when viewing
  useEffect(() => {
    if (isOpen && roomId && messages.length > 0) {
      markAsRead("support");
    }
  }, [isOpen, roomId, messages.length, markAsRead]);

  const initRoom = async () => {
    if (!customerId) return;

    setIsInitingRoom(true);
    try {
      if (!isAuthenticated) {
        // Guests: must issue a fresh signed token via edge function.
        const session = await initGuestSession({
          customer_name: customerName,
          customer_email: guestInfo?.email,
          topic: guestInfo?.topic,
        });
        setIsNewRoom(false);
        setRoomId(session.room_id);
        // Keep guestInfo.id in sync with server-issued guest_id
        if (guestInfo && guestInfo.id !== session.guest_id) {
          setGuestInfo({ ...guestInfo, id: session.guest_id });
          localStorage.setItem("live_chat_guest_id", session.guest_id);
        }
        setGuestInitError(null);
      } else {
        const room = await findOrCreateRoom({
          id: customerId,
          name: customerName,
          email: user?.email || guestInfo?.email,
        });
        setIsNewRoom(room.last_message === null);
        setRoomId(room.id);
      }
    } catch (error) {
      console.error("Error initializing room:", error);
      setGuestInitError(
        error instanceof Error ? error.message : "Không thể khởi tạo phiên chat",
      );
    } finally {
      setIsInitingRoom(false);
    }
  };

  // Generate guest ID
  const generateGuestId = () => {
    // Prefer a previously stored signed session; otherwise reuse the legacy
    // guest_id (server will re-issue a fresh token on init regardless).
    const session = loadGuestSession();
    if (session?.guest_id) return session.guest_id;
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
      // For new guests: show pre-chat form first.
      // For returning guests with existing session, reuse it transparently.
      const existing = loadGuestSession();
      if (existing) {
        setGuestInfo({
          id: existing.guest_id,
          name: `Khách #${existing.guest_id.slice(-4)}`,
        });
      } else {
        setShowPreChat(true);
      }
    }
    setIsOpen(true);
    setIsMinimized(false);
    handleUserActivity();
  };

  const handlePreChatSubmit = (data: PreChatPayload) => {
    const guestId = generateGuestId();
    setGuestInfo({
      id: guestId,
      name: data.name,
      email: data.email,
      topic: data.topic,
    });
    setShowPreChat(false);
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
  const workingHoursText = hasOnlineAgent
    ? "Hỗ trợ viên đang trực tuyến"
    : isWorkingHours
    ? "Sẽ phản hồi sớm"
    : `Ngoài giờ (${BOT_CONFIG.WORKING_HOURS_START}:00-${BOT_CONFIG.WORKING_HOURS_END}:00)`;
  const statusDotClass = hasOnlineAgent
    ? "bg-green-400"
    : isWorkingHours
    ? "bg-yellow-400"
    : "bg-muted-foreground";

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
                    statusDotClass
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
              {showPreChat ? (
                <PreChatForm onStart={handlePreChatSubmit} isLoading={isInitingRoom} />
              ) : (
                <>
                  <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                    {guestInfo?.topic && messages.length === 0 && (
                      <div className="px-4 py-2 text-[11px] text-muted-foreground bg-muted/50 border-b">
                        Chủ đề:{" "}
                        <span className="font-medium text-foreground">
                          {TOPIC_LABELS[guestInfo.topic] ?? guestInfo.topic}
                        </span>
                      </div>
                    )}
                    <MessageList
                      messages={messages}
                      currentUserId={customerId}
                      typingText={typingText}
                      isLoading={isLoading || isInitingRoom}
                    />
                  </div>

                  <MessageInput
                    onSend={handleSend}
                    onTyping={handleTyping}
                    onUpload={uploadAttachment}
                    disabled={isSending || !roomId}
                    placeholder="Nhập tin nhắn..."
                  />
                </>
              )}
            </>
          )}
        </Card>
      )}
    </>
  );
}
