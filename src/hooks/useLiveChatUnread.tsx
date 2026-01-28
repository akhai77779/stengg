import { useState, useEffect, useCallback, useRef } from "react";

const STORAGE_KEY = "live_chat_admin_unread";
const SOUND_ENABLED_KEY = "live_chat_sound_enabled";

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
  
  // Track if component is mounted to prevent playing sound on initial load
  const isMounted = useRef(false);

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(unreadCount));
  }, [unreadCount]);
  
  // Persist sound preference
  useEffect(() => {
    localStorage.setItem(SOUND_ENABLED_KEY, String(soundEnabled));
  }, [soundEnabled]);
  
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
          if (data.count > prevCount && isMounted.current && soundEnabled) {
            playNotificationSound();
          }
          setUnreadCount(data.count);
        } else if (data.type === "new_message") {
          if (isMounted.current && soundEnabled) {
            playNotificationSound();
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
  }, [soundEnabled]);

  // Manual clear function
  const clearUnread = useCallback(() => {
    setUnreadCount(0);
  }, []);

  // Increment for testing/demo (plays sound)
  const incrementUnread = useCallback((count = 1) => {
    if (soundEnabled) {
      playNotificationSound();
    }
    setUnreadCount((prev) => prev + count);
  }, [soundEnabled]);
  
  // Toggle sound
  const toggleSound = useCallback(() => {
    setSoundEnabled((prev) => !prev);
  }, []);

  return {
    unreadCount,
    clearUnread,
    incrementUnread,
    hasUnread: unreadCount > 0,
    soundEnabled,
    toggleSound,
    playSound: playNotificationSound,
  };
}
