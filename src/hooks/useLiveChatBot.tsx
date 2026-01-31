import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LiveChatMessage } from "@/hooks/useLiveChatMessages";

// Bot configuration
const BOT_CONFIG = {
  // Time to wait before bot responds (in milliseconds)
  AUTO_REPLY_DELAY: 30000, // 30 seconds
  // Bot messages
  WELCOME_MESSAGE: "Xin chào! Cảm ơn bạn đã liên hệ với chúng tôi. Hiện tại các nhân viên hỗ trợ đang bận, vui lòng chờ trong giây lát hoặc để lại tin nhắn, chúng tôi sẽ phản hồi sớm nhất có thể.",
  OFFLINE_MESSAGE: "Cảm ơn bạn đã liên hệ! Hiện tại đang ngoài giờ làm việc. Chúng tôi sẽ phản hồi bạn vào ngày làm việc tiếp theo.",
  BUSY_MESSAGE: "Cảm ơn bạn đã chờ đợi! Nhân viên hỗ trợ của chúng tôi đang xử lý nhiều yêu cầu. Chúng tôi sẽ phản hồi bạn sớm nhất có thể.",
  BOT_NAME: "Trợ lý ảo",
};

interface UseLiveChatBotOptions {
  roomId: string | null;
  messages: LiveChatMessage[];
  enabled?: boolean;
}

/**
 * Hook to manage auto-reply bot for live chat
 */
export function useLiveChatBot({
  roomId,
  messages,
  enabled = true,
}: UseLiveChatBotOptions) {
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const lastProcessedMessageRef = useRef<string | null>(null);

  // Send bot message
  const sendBotMessage = useCallback(
    async (message: string) => {
      if (!roomId) return;

      try {
        const { error } = await supabase.from("live_chat_messages").insert({
          room_id: roomId,
          sender_type: "bot",
          sender_id: null,
          sender_name: BOT_CONFIG.BOT_NAME,
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

  // Check if bot should respond
  const shouldBotRespond = useCallback(() => {
    if (!enabled || messages.length === 0) return false;

    // Get last message
    const lastMessage = messages[messages.length - 1];

    // Don't respond if last message is from support or bot
    if (lastMessage.sender_type !== "customer") return false;

    // Don't respond if we already processed this message
    if (lastProcessedMessageRef.current === lastMessage.id) return false;

    // Check if there's already a support/bot response after this customer message
    const lastCustomerMsgTime = new Date(lastMessage.created_at).getTime();
    const hasResponse = messages.some((m) => {
      if (m.sender_type === "customer") return false;
      const msgTime = new Date(m.created_at).getTime();
      return msgTime > lastCustomerMsgTime;
    });

    return !hasResponse;
  }, [enabled, messages]);

  // Schedule bot response
  useEffect(() => {
    if (!enabled || !roomId) return;

    // Clear existing timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (shouldBotRespond()) {
      const lastMessage = messages[messages.length - 1];
      const timeSinceMessage =
        Date.now() - new Date(lastMessage.created_at).getTime();

      // If enough time has passed, respond immediately
      if (timeSinceMessage >= BOT_CONFIG.AUTO_REPLY_DELAY) {
        lastProcessedMessageRef.current = lastMessage.id;
        sendBotMessage(BOT_CONFIG.BUSY_MESSAGE);
      } else {
        // Schedule response for later
        const delay = BOT_CONFIG.AUTO_REPLY_DELAY - timeSinceMessage;
        timerRef.current = setTimeout(() => {
          // Re-check if we should still respond
          if (shouldBotRespond()) {
            lastProcessedMessageRef.current = lastMessage.id;
            sendBotMessage(BOT_CONFIG.BUSY_MESSAGE);
          }
        }, delay);
      }
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [enabled, roomId, messages, shouldBotRespond, sendBotMessage]);

  // Send welcome message when room is first created
  const sendWelcomeMessage = useCallback(async () => {
    await sendBotMessage(BOT_CONFIG.WELCOME_MESSAGE);
  }, [sendBotMessage]);

  return {
    sendWelcomeMessage,
    sendBotMessage,
    config: BOT_CONFIG,
  };
}

/**
 * Get appropriate bot message based on time of day
 */
export function getBotMessageForTime(): string {
  const hour = new Date().getHours();
  
  // Office hours: 8 AM - 6 PM
  if (hour >= 8 && hour < 18) {
    return BOT_CONFIG.BUSY_MESSAGE;
  } else {
    return BOT_CONFIG.OFFLINE_MESSAGE;
  }
}
