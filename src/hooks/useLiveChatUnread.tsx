import { useState, useEffect, useCallback, useRef } from "react";

const STORAGE_KEY = "live_chat_admin_unread";
const SOUND_ENABLED_KEY = "live_chat_sound_enabled";
const DESKTOP_NOTIFICATION_KEY = "live_chat_desktop_notification_enabled";

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
 * Play a pleasant "ding" notification sound using Web Audio API
 */
function playNotificationSound() {
  try {
    const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    
    // Create oscillator for the "ding" sound
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // Pleasant chime frequency (C6 note)
    oscillator.frequency.setValueAtTime(1047, audioContext.currentTime);
    oscillator.type = "sine";
    
    // Quick fade in and out for a clean sound
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
    
    // Second tone for "ding-dong" effect
    setTimeout(() => {
      const osc2 = audioContext.createOscillator();
      const gain2 = audioContext.createGain();
      
      osc2.connect(gain2);
      gain2.connect(audioContext.destination);
      
      // Higher frequency (E6 note)
      osc2.frequency.setValueAtTime(1319, audioContext.currentTime);
      osc2.type = "sine";
      
      gain2.gain.setValueAtTime(0, audioContext.currentTime);
      gain2.gain.linearRampToValueAtTime(0.25, audioContext.currentTime + 0.02);
      gain2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
      
      osc2.start(audioContext.currentTime);
      osc2.stop(audioContext.currentTime + 0.4);
    }, 150);
    
  } catch (err) {
    console.warn("Could not play notification sound:", err);
  }
}

/**
 * Request browser notification permission
 */
async function requestNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) {
    console.warn("This browser does not support desktop notifications");
    return false;
  }
  
  if (Notification.permission === "granted") {
    return true;
  }
  
  if (Notification.permission !== "denied") {
    const permission = await Notification.requestPermission();
    return permission === "granted";
  }
  
  return false;
}

/**
 * Send a desktop notification
 */
function sendDesktopNotification(title: string, body: string, onClick?: () => void) {
  if (!("Notification" in window) || Notification.permission !== "granted") {
    return;
  }
  
  const notification = new Notification(title, {
    body,
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    tag: `live-chat-${Date.now()}`,
    requireInteraction: false,
  });
  
  // Auto close after 5 seconds
  setTimeout(() => notification.close(), 5000);
  
  // Focus window when clicked
  notification.onclick = () => {
    window.focus();
    notification.close();
    onClick?.();
  };
}

/**
 * Hook to track unread live chat messages for admin panel.
 * Listens to postMessage from iframe and persists count in localStorage.
 * Plays notification sound when new messages arrive.
 */
export function useLiveChatUnread() {
  const [unreadCount, setUnreadCount] = useState<number>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    const parsed = stored ? Number(stored) : 0;
    return Number.isFinite(parsed) ? parsed : 0;
  });
  
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    const stored = localStorage.getItem(SOUND_ENABLED_KEY);
    return stored !== "false"; // Default to true
  });
  
  const [desktopNotificationEnabled, setDesktopNotificationEnabled] = useState<boolean>(() => {
    const stored = localStorage.getItem(DESKTOP_NOTIFICATION_KEY);
    return stored !== "false"; // Default to true
  });
  
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(
    "Notification" in window ? Notification.permission : "denied"
  );
  
  // Track if component is mounted to prevent notifications on initial load
  const isMounted = useRef(false);

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(unreadCount));
  }, [unreadCount]);
  
  // Persist sound preference
  useEffect(() => {
    localStorage.setItem(SOUND_ENABLED_KEY, String(soundEnabled));
  }, [soundEnabled]);
  
  // Persist desktop notification preference
  useEffect(() => {
    localStorage.setItem(DESKTOP_NOTIFICATION_KEY, String(desktopNotificationEnabled));
  }, [desktopNotificationEnabled]);
  
  // Request notification permission on mount if enabled
  useEffect(() => {
    if (desktopNotificationEnabled && notificationPermission === "default") {
      requestNotificationPermission().then((granted) => {
        setNotificationPermission(granted ? "granted" : "denied");
      });
    }
  }, [desktopNotificationEnabled, notificationPermission]);
  
  // Set mounted flag after initial render
  useEffect(() => {
    const timer = setTimeout(() => {
      isMounted.current = true;
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

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
          const prevCount = parseInt(localStorage.getItem(STORAGE_KEY) || "0", 10);
          if (data.count > prevCount && isMounted.current) {
            if (soundEnabled) {
              playNotificationSound();
            }
            if (desktopNotificationEnabled) {
              const newMessages = data.count - prevCount;
              sendDesktopNotification(
                "💬 Tin nhắn hỗ trợ mới",
                `Bạn có ${newMessages} tin nhắn mới từ khách hàng`
              );
            }
          }
          setUnreadCount(data.count);
        } else if (data.type === "new_message") {
          if (isMounted.current) {
            if (soundEnabled) {
              playNotificationSound();
            }
            if (desktopNotificationEnabled) {
              const senderName = data.message?.sender || "Khách hàng";
              const messagePreview = data.message?.text 
                ? (data.message.text.length > 50 
                    ? data.message.text.substring(0, 50) + "..." 
                    : data.message.text)
                : "Tin nhắn mới";
              sendDesktopNotification(
                `💬 ${senderName}`,
                messagePreview
              );
            }
          }
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
  }, [soundEnabled, desktopNotificationEnabled]);

  // Manual clear function
  const clearUnread = useCallback(() => {
    setUnreadCount(0);
  }, []);

  // Increment for testing/demo (plays sound and desktop notification)
  const incrementUnread = useCallback((count = 1) => {
    if (soundEnabled) {
      playNotificationSound();
    }
    if (desktopNotificationEnabled) {
      sendDesktopNotification(
        "💬 Tin nhắn hỗ trợ mới",
        `Bạn có ${count} tin nhắn mới từ khách hàng`
      );
    }
    setUnreadCount((prev) => prev + count);
  }, [soundEnabled, desktopNotificationEnabled]);
  
  // Toggle sound
  const toggleSound = useCallback(() => {
    setSoundEnabled((prev) => !prev);
  }, []);
  
  // Toggle desktop notification
  const toggleDesktopNotification = useCallback(async () => {
    if (!desktopNotificationEnabled) {
      // Request permission when enabling
      const granted = await requestNotificationPermission();
      setNotificationPermission(granted ? "granted" : "denied");
      if (granted) {
        setDesktopNotificationEnabled(true);
      }
    } else {
      setDesktopNotificationEnabled(false);
    }
  }, [desktopNotificationEnabled]);

  return {
    unreadCount,
    clearUnread,
    incrementUnread,
    hasUnread: unreadCount > 0,
    soundEnabled,
    toggleSound,
    desktopNotificationEnabled,
    toggleDesktopNotification,
    notificationPermission,
    playSound: playNotificationSound,
  };
}
