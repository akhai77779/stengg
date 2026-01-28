import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "live_chat_admin_unread";

interface LiveChatMessage {
  type: "unread_count" | "new_message" | "messages_read";
  count?: number;
  message?: {
    id: string;
    sender: string;
    text: string;
  };
}

/**
 * Hook to track unread live chat messages for admin panel.
 * Listens to postMessage from iframe and persists count in localStorage.
 */
export function useLiveChatUnread() {
  const [unreadCount, setUnreadCount] = useState<number>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    const parsed = stored ? Number(stored) : 0;
    return Number.isFinite(parsed) ? parsed : 0;
  });

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(unreadCount));
  }, [unreadCount]);

  // Listen for postMessage from iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Accept messages from the support domain
      if (!event.origin.includes("stengg.it.com") && !event.origin.includes("localhost")) {
        return;
      }

      try {
        const data: LiveChatMessage = 
          typeof event.data === "string" ? JSON.parse(event.data) : event.data;

        if (data.type === "unread_count" && typeof data.count === "number") {
          setUnreadCount(data.count);
        } else if (data.type === "new_message") {
          setUnreadCount((prev) => prev + 1);
        } else if (data.type === "messages_read") {
          setUnreadCount(0);
        }
      } catch {
        // Ignore invalid messages
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // Manual clear function
  const clearUnread = useCallback(() => {
    setUnreadCount(0);
  }, []);

  // Increment for testing/demo
  const incrementUnread = useCallback((count = 1) => {
    setUnreadCount((prev) => prev + count);
  }, []);

  return {
    unreadCount,
    clearUnread,
    incrementUnread,
    hasUnread: unreadCount > 0,
  };
}
