import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

interface TypingStatus {
  id: string;
  room_id: string;
  user_id: string;
  user_name: string;
  user_type: "customer" | "support";
  is_typing: boolean;
  updated_at: string;
}

interface UseLiveChatTypingOptions {
  userId: string;
  userName: string;
  userType: "customer" | "support";
  debounceMs?: number;
}

export function useLiveChatTyping(
  roomId: string | null,
  options: UseLiveChatTypingOptions
) {
  const { userId, userName, userType, debounceMs = 2000 } = options;
  const [othersTyping, setOthersTyping] = useState<TypingStatus[]>([]);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isTypingRef = useRef(false);

  // Update typing status in database
  const setTyping = useCallback(
    async (isTyping: boolean) => {
      if (!roomId || !userId) return;

      try {
        // Upsert typing status
        await supabase.from("live_chat_typing").upsert(
          {
            room_id: roomId,
            user_id: userId,
            user_name: userName,
            user_type: userType,
            is_typing: isTyping,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "room_id,user_id",
          }
        );

        isTypingRef.current = isTyping;
      } catch (error) {
        console.error("Error updating typing status:", error);
      }
    },
    [roomId, userId, userName, userType]
  );

  // Start typing (with debounce)
  const startTyping = useCallback(() => {
    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set typing if not already
    if (!isTypingRef.current) {
      setTyping(true);
    }

    // Set timeout to stop typing
    typingTimeoutRef.current = setTimeout(() => {
      setTyping(false);
    }, debounceMs);
  }, [setTyping, debounceMs]);

  // Stop typing immediately
  const stopTyping = useCallback(() => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    setTyping(false);
  }, [setTyping]);

  // Fetch typing statuses
  const fetchTypingStatuses = useCallback(async () => {
    if (!roomId) return;

    try {
      const { data } = await supabase
        .from("live_chat_typing")
        .select("*")
        .eq("room_id", roomId)
        .eq("is_typing", true);

      if (data) {
        // Filter out stale typing statuses (older than 5 seconds)
        const now = Date.now();
        const activeTyping = (data as TypingStatus[]).filter(
          (status) =>
            status.user_id !== userId &&
            now - new Date(status.updated_at).getTime() < 5000
        );
        setOthersTyping(activeTyping);
      }
    } catch (error) {
      console.error("Error fetching typing status:", error);
    }
  }, [roomId, userId]);

  // Poll for typing status
  useEffect(() => {
    if (!roomId) return;

    fetchTypingStatuses();
    const interval = setInterval(fetchTypingStatuses, 1000);

    return () => clearInterval(interval);
  }, [roomId, fetchTypingStatuses]);

  // Realtime subscription for typing
  useEffect(() => {
    if (!roomId) return;

    const channel = supabase
      .channel(`typing-${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "live_chat_typing",
          filter: `room_id=eq.${roomId}`,
        },
        () => {
          fetchTypingStatuses();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, fetchTypingStatuses]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      // Stop typing when component unmounts
      if (roomId && userId) {
        supabase
          .from("live_chat_typing")
          .update({ is_typing: false })
          .eq("room_id", roomId)
          .eq("user_id", userId)
          .then(() => {});
      }
    };
  }, [roomId, userId]);

  // Get typing indicator text
  const typingText = othersTyping.length > 0
    ? othersTyping.length === 1
      ? `${othersTyping[0].user_name} đang nhập...`
      : `${othersTyping.length} người đang nhập...`
    : null;

  return {
    startTyping,
    stopTyping,
    othersTyping,
    isOtherTyping: othersTyping.length > 0,
    typingText,
  };
}
