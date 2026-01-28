import { useEffect, useState, useCallback } from "react";
import { MessageCircle, X, Minimize2, Maximize2, Send, Paperclip, Image } from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useLiveChatMessages } from "@/hooks/useLiveChatMessages";
import { useLiveChatTyping } from "@/hooks/useLiveChatTyping";
import { useLiveChatRooms } from "@/hooks/useLiveChatRooms";
import { useAuth } from "@/hooks/useAuth";
import { MessageList, MessageInput } from "@/components/live-chat/MessageComponents";

/**
 * Mobile-only CSKH quick actions with integrated live chat.
 * (Icon in header; opens inline chat on mobile.)
 */
export function SupportMenuButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
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
        console.warn("SupportMenuButton: cannot load settings", e);
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

  // Handle open chat
  const handleOpen = () => {
    if (!isAuthenticated && !guestInfo) {
      const guestId = generateGuestId();
      setGuestInfo({
        id: guestId,
        name: `Khách #${guestId.slice(-4)}`,
      });
    }
    setIsOpen(true);
    setIsMinimized(false);
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

  if (!supportEnabled) return null;

  return (
    <>
      {/* Trigger button - only on mobile */}
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden relative"
        onClick={handleOpen}
      >
        <span className="relative">
          {isOpen ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
          {unreadCount > 0 && !isOpen && (
            <span className="absolute -right-1.5 -top-1.5 min-w-[18px] rounded-full bg-destructive px-1 text-center text-[10px] font-semibold leading-[18px] text-destructive-foreground">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </span>
        <span className="sr-only">CSKH</span>
      </Button>

      {/* Fullscreen chat overlay for mobile */}
      {isOpen && (
        <div className="fixed inset-0 z-[9999] bg-background md:hidden flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-3 bg-primary text-primary-foreground safe-area-top">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              <span className="font-medium">Chat với chúng tôi</span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 hover:bg-primary-foreground/20"
                onClick={() => setIsOpen(false)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Message list */}
          <div className="flex-1 overflow-hidden">
            <MessageList
              messages={messages}
              currentUserId={customerId}
              typingText={typingText}
              isLoading={isLoading}
            />
          </div>

          {/* Input */}
          <div className="safe-area-bottom">
            <MessageInput
              onSend={handleSend}
              onTyping={startTyping}
              onUpload={uploadAttachment}
              disabled={isSending || !roomId}
              placeholder="Nhập tin nhắn..."
            />
          </div>
        </div>
      )}
    </>
  );
}
