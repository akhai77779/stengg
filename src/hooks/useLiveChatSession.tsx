import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BOT_CONFIG, isWithinWorkingHours } from "./useLiveChatBot";

interface UseLiveChatSessionOptions {
  roomId: string | null;
  customerId: string;
  customerName: string;
  onSessionClosed?: () => void;
  onSessionResumed?: () => void;
}

/**
 * Hook to manage live chat session state and auto-close
 */
export function useLiveChatSession({
  roomId,
  customerId,
  customerName,
  onSessionClosed,
  onSessionResumed,
}: UseLiveChatSessionOptions) {
  const [isSessionActive, setIsSessionActive] = useState(true);
  const [lastActivityTime, setLastActivityTime] = useState<Date>(new Date());
  const sessionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstOpen = useRef<boolean>(true);

  // Record activity
  const recordActivity = useCallback(() => {
    setLastActivityTime(new Date());
    setIsSessionActive(true);
  }, []);

  // Check if session should be resumed (was previously closed)
  const checkAndResumeSession = useCallback(async () => {
    if (!roomId) return false;

    try {
      const { data: room } = await supabase
        .from("live_chat_rooms")
        .select("status, last_updated_at")
        .eq("id", roomId)
        .single();

      if (room?.status === "closed") {
        // Reopen the room
        await supabase
          .from("live_chat_rooms")
          .update({
            status: "active",
            last_updated_at: new Date().toISOString(),
          })
          .eq("id", roomId);

        setIsSessionActive(true);
        onSessionResumed?.();
        return true;
      }

      return false;
    } catch (error) {
      console.error("Error checking session:", error);
      return false;
    }
  }, [roomId, onSessionResumed]);

  // Close session due to inactivity
  const closeSessionDueToInactivity = useCallback(async () => {
    if (!roomId) return;

    try {
      // Send timeout message
      await supabase.from("live_chat_messages").insert({
        room_id: roomId,
        sender_type: "bot",
        sender_id: null,
        sender_name: "Hệ thống",
        message: BOT_CONFIG.SESSION_TIMEOUT_MESSAGE,
        is_read: false,
      });

      // Update room status
      await supabase
        .from("live_chat_rooms")
        .update({
          status: "closed",
          last_message: BOT_CONFIG.SESSION_TIMEOUT_MESSAGE,
          last_updated_at: new Date().toISOString(),
        })
        .eq("id", roomId);

      setIsSessionActive(false);
      onSessionClosed?.();
    } catch (error) {
      console.error("Error closing session:", error);
    }
  }, [roomId, onSessionClosed]);

  // Send welcome message on first open
  const sendWelcomeSequence = useCallback(async () => {
    if (!roomId || !isFirstOpen.current) return;
    isFirstOpen.current = false;

    try {
      // Check if this is a resumed session
      const wasResumed = await checkAndResumeSession();
      
      if (wasResumed) {
        // Send resumed message
        const message = isWithinWorkingHours()
          ? BOT_CONFIG.SESSION_RESUMED_MESSAGE
          : BOT_CONFIG.OFFLINE_MESSAGE;

        await supabase.from("live_chat_messages").insert({
          room_id: roomId,
          sender_type: "bot",
          sender_id: null,
          sender_name: BOT_CONFIG.BOT_NAME,
          message,
          is_read: false,
        });
      } else {
        // Check if room already has messages (not new)
        const { data: existingMessages } = await supabase
          .from("live_chat_messages")
          .select("id")
          .eq("room_id", roomId)
          .limit(1);

        if (!existingMessages || existingMessages.length === 0) {
          // New room - send welcome sequence
          if (!isWithinWorkingHours()) {
            await supabase.from("live_chat_messages").insert({
              room_id: roomId,
              sender_type: "bot",
              sender_id: null,
              sender_name: "Hệ thống",
              message: BOT_CONFIG.OFFLINE_MESSAGE,
              is_read: false,
            });
          } else {
            // Send welcome
            await supabase.from("live_chat_messages").insert({
              room_id: roomId,
              sender_type: "bot",
              sender_id: null,
              sender_name: BOT_CONFIG.BOT_NAME,
              message: BOT_CONFIG.WELCOME_MESSAGE,
              is_read: false,
            });

            // Send connecting message after delay
            setTimeout(async () => {
              await supabase.from("live_chat_messages").insert({
                room_id: roomId,
                sender_type: "bot",
                sender_id: null,
                sender_name: BOT_CONFIG.BOT_NAME,
                message: BOT_CONFIG.CONNECTING_MESSAGE,
                is_read: false,
              });
            }, 1500);
          }
        }
      }

      // Update room last message
      await supabase
        .from("live_chat_rooms")
        .update({
          last_updated_at: new Date().toISOString(),
        })
        .eq("id", roomId);
    } catch (error) {
      console.error("Error in welcome sequence:", error);
    }
  }, [roomId, checkAndResumeSession]);

  // Reset session timeout
  const resetSessionTimeout = useCallback(() => {
    if (sessionTimeoutRef.current) {
      clearTimeout(sessionTimeoutRef.current);
    }

    sessionTimeoutRef.current = setTimeout(() => {
      closeSessionDueToInactivity();
    }, BOT_CONFIG.SESSION_TIMEOUT);

    recordActivity();
  }, [closeSessionDueToInactivity, recordActivity]);

  // Initialize session on mount
  useEffect(() => {
    if (roomId) {
      sendWelcomeSequence();
      resetSessionTimeout();
    }

    return () => {
      if (sessionTimeoutRef.current) {
        clearTimeout(sessionTimeoutRef.current);
      }
    };
  }, [roomId]);

  // Record activity on user interactions
  const handleUserActivity = useCallback(() => {
    resetSessionTimeout();
  }, [resetSessionTimeout]);

  return {
    isSessionActive,
    lastActivityTime,
    handleUserActivity,
    resetSessionTimeout,
    checkAndResumeSession,
    sendWelcomeSequence,
  };
}
