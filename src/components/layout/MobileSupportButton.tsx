import { useState, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { MessageCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useLiveChatMessages } from "@/hooks/useLiveChatMessages";
import { useLiveChatTyping } from "@/hooks/useLiveChatTyping";
import { useLiveChatRooms } from "@/hooks/useLiveChatRooms";
import { useAuth } from "@/hooks/useAuth";
import { MessageList, MessageInput } from "@/components/live-chat/MessageComponents";
import { useLiveChat } from "@/contexts/LiveChatContext";

/**
 * Global floating support button with fullscreen chat overlay.
 * Works on both mobile (FAB) and desktop (inline modal).
 */
export function MobileSupportButton() {
  const location = useLocation();
  const isAdminPage = location.pathname.startsWith('/admin');
  const { isOpen, openChat, closeChat } = useLiveChat();
  const [supportEnabled, setSupportEnabled] = useState(true);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [guestInfo, setGuestInfo] = useState<{
    id: string;
    name: string;
    email?: string;
  } | null>(null);

  const { user } = useAuth();
  const isAuthenticated = !!user;
  const { findOrCreateRoom } = useLiveChatRooms();

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
      if (msg.sender_type === "support" || msg.sender_type === "bot") {
        playNotificationSound();
      }
    },
  });

  const { startTyping, typingText } = useLiveChatTyping(roomId, {
    userId: customerId,
    userName: customerName,
    userType: "customer",
  });

  // Load support settings
  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const { data, error } = await supabase
          .from("app_settings")
          .select("key,value")
          .in("key", ["support_enabled"]);

        if (error) throw error;

        const map = new Map<string, unknown>();
        (data ?? []).forEach((row) => map.set(row.key, row.value));

        const support = map.get("support_enabled") as { enabled?: boolean } | undefined;

        if (!mounted) return;
        setSupportEnabled(Boolean(support?.enabled ?? true));
      } catch (e) {
        console.warn("MobileSupportButton: cannot load settings", e);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, []);

  // Initialize room when chat opens
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

  // Auto-generate guest info when opening
  useEffect(() => {
    if (isOpen && !isAuthenticated && !guestInfo) {
      const guestId = generateGuestId();
      setGuestInfo({
        id: guestId,
        name: `Khách #${guestId.slice(-4)}`,
      });
    }
  }, [isOpen, isAuthenticated, guestInfo]);

  const initRoom = async () => {
    if (!customerId) return;

    try {
      const room = await findOrCreateRoom({
        id: customerId,
        name: customerName,
        email: user?.email || guestInfo?.email,
      });
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

  // Handle send message
  const handleSend = async (
    message: string,
    attachment?: { url: string; type: "image" | "file"; name: string }
  ) => {
    if (!roomId) return;

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

  if (!supportEnabled || isAdminPage) return null;

  // Chat only opens via CSKH buttons (no floating FAB)
  if (!isOpen) return null;

  return (
    <>

      {/* Fullscreen chat overlay - Mobile */}
      <div
        className={cn(
          "fixed inset-0 z-[9999] bg-background md:hidden flex flex-col transition-all duration-300 ease-out",
          isOpen
            ? "opacity-100 translate-y-0 pointer-events-auto"
            : "opacity-0 translate-y-full pointer-events-none"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3 bg-primary text-primary-foreground safe-area-top">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            <span className="font-medium">Chat với chúng tôi</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 hover:bg-primary-foreground/20 active:scale-95 transition-transform"
            onClick={closeChat}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Message list with fade animation */}
        <div
          className={cn(
            "flex-1 min-h-0 flex flex-col transition-opacity duration-200 delay-100",
            isOpen ? "opacity-100" : "opacity-0"
          )}
        >
          <MessageList
            messages={messages}
            currentUserId={customerId}
            typingText={typingText}
            isLoading={isLoading}
          />
        </div>

        {/* Input with slide up animation */}
        <div
          className={cn(
            "safe-area-bottom transition-all duration-200 delay-150",
            isOpen ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          )}
        >
          <MessageInput
            onSend={handleSend}
            onTyping={startTyping}
            onUpload={uploadAttachment}
            disabled={isSending || !roomId}
            placeholder="Nhập tin nhắn..."
          />
        </div>
      </div>

      {/* Desktop chat modal */}
      {isOpen && (
        <div className="fixed bottom-4 right-4 z-[9999] hidden md:block w-[400px] h-[550px] rounded-xl shadow-2xl overflow-hidden border border-border bg-background">
          {/* Header */}
          <div className="flex items-center justify-between p-3 bg-primary text-primary-foreground">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              <span className="font-medium">Chat với chúng tôi</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 hover:bg-primary-foreground/20"
              onClick={closeChat}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Message list */}
          <div className="h-[calc(100%-110px)] flex flex-col">
            <MessageList
              messages={messages}
              currentUserId={customerId}
              typingText={typingText}
              isLoading={isLoading}
            />
          </div>

          {/* Input */}
          <MessageInput
            onSend={handleSend}
            onTyping={startTyping}
            onUpload={uploadAttachment}
            disabled={isSending || !roomId}
            placeholder="Nhập tin nhắn..."
          />
        </div>
      )}
    </>
  );
}
