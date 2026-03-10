import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LiveChatMessage } from "@/hooks/useLiveChatMessages";

// Bot configuration - Updated timing
export const BOT_CONFIG = {
  // Working hours (24h format)
  WORKING_HOURS_START: 9, // 9:00 AM
  WORKING_HOURS_END: 23, // 11:00 PM
  
  // Timing settings (in milliseconds)
  ADMIN_BUSY_DELAY: 5 * 60 * 1000, // 5 minutes - admin không phản hồi
  SESSION_TIMEOUT: 10 * 60 * 1000, // 10 minutes - user không hoạt động
  
  // Bot messages
  WELCOME_MESSAGE: "Welcome to ST Engineering. We are now connecting you to your dedicated regional customer service representative. Please hold on for a moment.",
  CONNECTING_MESSAGE: "Our support team will respond to you shortly.",
  BUSY_MESSAGE: "Our customer service team is currently assisting other customers. Please wait a moment, we will be with you as soon as possible.",
  OFFLINE_MESSAGE: "Chào bạn! Hiện tại đã hết giờ làm việc. Thời gian hỗ trợ: 9:00 - 23:00 hàng ngày. Vui lòng để lại tin nhắn, chúng tôi sẽ phản hồi bạn vào ngày làm việc tiếp theo.",
  SESSION_TIMEOUT_MESSAGE: "Phiên chat đã kết thúc do không có hoạt động trong 10 phút. Bạn có thể bắt đầu cuộc trò chuyện mới bất cứ lúc nào.",
  SESSION_RESUMED_MESSAGE: "Chào mừng bạn quay lại! Support ST Engineering sẵn sàng hỗ trợ bạn.",
  
  BOT_NAME: "Hệ thống",
};

interface UseLiveChatBotOptions {
  roomId: string | null;
  messages: LiveChatMessage[];
  enabled?: boolean;
  isNewRoom?: boolean;
}

/**
 * Check if current time is within working hours
 */
export function isWithinWorkingHours(): boolean {
  const now = new Date();
  const hour = now.getHours();
  return hour >= BOT_CONFIG.WORKING_HOURS_START && hour < BOT_CONFIG.WORKING_HOURS_END;
}

/**
 * Get working hours display string
 */
export function getWorkingHoursString(): string {
  return `${BOT_CONFIG.WORKING_HOURS_START}:00 - ${BOT_CONFIG.WORKING_HOURS_END}:00`;
}

/**
 * Hook to manage auto-reply bot for live chat
 */
export function useLiveChatBot({
  roomId,
  messages,
  enabled = true,
  isNewRoom = false,
}: UseLiveChatBotOptions) {
  const adminBusyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastProcessedMessageRef = useRef<string | null>(null);
  const welcomeSentRef = useRef<boolean>(false);
  const sessionClosedRef = useRef<boolean>(false);

  // Send bot message
  const sendBotMessage = useCallback(
    async (message: string, isSystem: boolean = false) => {
      if (!roomId) return;

      try {
        const { error } = await supabase.from("live_chat_messages").insert({
          room_id: roomId,
          sender_type: "bot",
          sender_id: null,
          sender_name: isSystem ? "Hệ thống" : BOT_CONFIG.BOT_NAME,
          message,
          is_read: false,
        });

        if (error) {
          console.error("Bot message error:", error);
        }

        // Update room's last message
        await supabase
          .from("live_chat_rooms")
          .update({
            last_message: message,
            last_updated_at: new Date().toISOString(),
          })
          .eq("id", roomId);
      } catch (error) {
        console.error("Bot send error:", error);
      }
    },
    [roomId]
  );

  // Close session (set room status to closed)
  const closeSession = useCallback(async () => {
    if (!roomId || sessionClosedRef.current) return;
    
    sessionClosedRef.current = true;
    
    try {
      await sendBotMessage(BOT_CONFIG.SESSION_TIMEOUT_MESSAGE, true);
      
      await supabase
        .from("live_chat_rooms")
        .update({
          status: "closed",
          last_updated_at: new Date().toISOString(),
        })
        .eq("id", roomId);
    } catch (error) {
      console.error("Close session error:", error);
    }
  }, [roomId, sendBotMessage]);

  // Send welcome message when room opens
  const sendWelcomeMessage = useCallback(async () => {
    if (welcomeSentRef.current) return;
    welcomeSentRef.current = true;
    
    // Check working hours first
    if (!isWithinWorkingHours()) {
      await sendBotMessage(BOT_CONFIG.OFFLINE_MESSAGE, true);
    } else {
      await sendBotMessage(BOT_CONFIG.WELCOME_MESSAGE, false);
      // Send connecting message after a short delay
      setTimeout(async () => {
        await sendBotMessage(BOT_CONFIG.CONNECTING_MESSAGE, false);
      }, 1500);
    }
  }, [sendBotMessage]);

  // Send resumed message when user returns
  const sendResumedMessage = useCallback(async () => {
    sessionClosedRef.current = false;
    
    if (!isWithinWorkingHours()) {
      await sendBotMessage(BOT_CONFIG.OFFLINE_MESSAGE, true);
    } else {
      await sendBotMessage(BOT_CONFIG.SESSION_RESUMED_MESSAGE, false);
    }
  }, [sendBotMessage]);

  // Check if admin has responded to customer message
  const hasAdminRespondedToLastCustomerMessage = useCallback(() => {
    if (messages.length === 0) return true;

    // Find last customer message
    let lastCustomerMsgIndex = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].sender_type === "customer") {
        lastCustomerMsgIndex = i;
        break;
      }
    }

    if (lastCustomerMsgIndex === -1) return true;

    // Check if there's a support response after
    for (let i = lastCustomerMsgIndex + 1; i < messages.length; i++) {
      if (messages[i].sender_type === "support") {
        return true;
      }
    }

    return false;
  }, [messages]);

  // Reset session timeout when there's activity
  const resetSessionTimeout = useCallback(() => {
    if (sessionTimeoutRef.current) {
      clearTimeout(sessionTimeoutRef.current);
    }

    sessionTimeoutRef.current = setTimeout(() => {
      closeSession();
    }, BOT_CONFIG.SESSION_TIMEOUT);
  }, [closeSession]);

  // Handle admin busy timer
  useEffect(() => {
    if (!enabled || !roomId || !isWithinWorkingHours()) return;

    // Clear existing timer
    if (adminBusyTimerRef.current) {
      clearTimeout(adminBusyTimerRef.current);
      adminBusyTimerRef.current = null;
    }

    // Check if we should start admin busy timer
    if (!hasAdminRespondedToLastCustomerMessage()) {
      const lastCustomerMsg = [...messages].reverse().find(m => m.sender_type === "customer");
      
      if (lastCustomerMsg && lastProcessedMessageRef.current !== lastCustomerMsg.id) {
        const timeSinceMessage = Date.now() - new Date(lastCustomerMsg.created_at).getTime();
        
        // Check if 5 minutes have already passed
        if (timeSinceMessage >= BOT_CONFIG.ADMIN_BUSY_DELAY) {
          // Check if we haven't already sent busy message for this
          const hasBusyResponse = messages.some((m, idx) => {
            if (m.sender_type !== "bot") return false;
            const customerIdx = messages.findIndex(msg => msg.id === lastCustomerMsg.id);
            return idx > customerIdx && m.message === BOT_CONFIG.BUSY_MESSAGE;
          });
          
          if (!hasBusyResponse) {
            lastProcessedMessageRef.current = lastCustomerMsg.id;
            sendBotMessage(BOT_CONFIG.BUSY_MESSAGE, false);
          }
        } else {
          // Schedule busy message
          const delay = BOT_CONFIG.ADMIN_BUSY_DELAY - timeSinceMessage;
          adminBusyTimerRef.current = setTimeout(() => {
            if (!hasAdminRespondedToLastCustomerMessage()) {
              lastProcessedMessageRef.current = lastCustomerMsg.id;
              sendBotMessage(BOT_CONFIG.BUSY_MESSAGE, false);
            }
          }, delay);
        }
      }
    }

    return () => {
      if (adminBusyTimerRef.current) {
        clearTimeout(adminBusyTimerRef.current);
      }
    };
  }, [enabled, roomId, messages, hasAdminRespondedToLastCustomerMessage, sendBotMessage]);

  // Handle session timeout - reset on any new message
  useEffect(() => {
    if (!enabled || !roomId) return;

    // Reset timeout when messages change (new activity)
    resetSessionTimeout();

    return () => {
      if (sessionTimeoutRef.current) {
        clearTimeout(sessionTimeoutRef.current);
      }
    };
  }, [enabled, roomId, messages.length, resetSessionTimeout]);

  // Send welcome message on new room
  useEffect(() => {
    if (enabled && roomId && isNewRoom && messages.length === 0) {
      sendWelcomeMessage();
    }
  }, [enabled, roomId, isNewRoom, messages.length, sendWelcomeMessage]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (adminBusyTimerRef.current) {
        clearTimeout(adminBusyTimerRef.current);
      }
      if (sessionTimeoutRef.current) {
        clearTimeout(sessionTimeoutRef.current);
      }
    };
  }, []);

  return {
    sendWelcomeMessage,
    sendResumedMessage,
    sendBotMessage,
    closeSession,
    resetSessionTimeout,
    isWithinWorkingHours: isWithinWorkingHours(),
    config: BOT_CONFIG,
  };
}

/**
 * Get appropriate bot message based on time of day
 */
export function getBotMessageForTime(): string {
  if (isWithinWorkingHours()) {
    return BOT_CONFIG.BUSY_MESSAGE;
  } else {
    return BOT_CONFIG.OFFLINE_MESSAGE;
  }
}
