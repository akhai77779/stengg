import { useMemo } from "react";
import { LiveChatMessage } from "@/hooks/useLiveChatMessages";
import { LiveChatRoom } from "@/hooks/useLiveChatRooms";

export interface ChatStats {
  avgResponseTime: number | null; // in seconds
  avgResponseTimeText: string;
  totalMessages: number;
  customerMessages: number;
  supportMessages: number;
  botMessages: number;
  responseRate: number; // percentage
}

export interface GlobalChatStats {
  avgResponseTime: number | null;
  avgResponseTimeText: string;
  totalRooms: number;
  activeRooms: number;
  waitingRooms: number;
  closedRooms: number;
  totalUnread: number;
}

/**
 * Calculate response time statistics for a single room
 */
export function useRoomChatStats(messages: LiveChatMessage[]): ChatStats {
  return useMemo(() => {
    if (messages.length === 0) {
      return {
        avgResponseTime: null,
        avgResponseTimeText: "N/A",
        totalMessages: 0,
        customerMessages: 0,
        supportMessages: 0,
        botMessages: 0,
        responseRate: 0,
      };
    }

    const customerMessages = messages.filter((m) => m.sender_type === "customer");
    const supportMessages = messages.filter((m) => m.sender_type === "support");
    const botMessages = messages.filter((m) => m.sender_type === "bot");

    // Calculate response times
    const responseTimes: number[] = [];

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      if (msg.sender_type === "customer") {
        // Find next support or bot response
        for (let j = i + 1; j < messages.length; j++) {
          const nextMsg = messages[j];
          if (nextMsg.sender_type === "support" || nextMsg.sender_type === "bot") {
            const responseTime =
              (new Date(nextMsg.created_at).getTime() - new Date(msg.created_at).getTime()) / 1000;
            if (responseTime > 0 && responseTime < 86400) {
              // Ignore responses > 24h
              responseTimes.push(responseTime);
            }
            break;
          }
        }
      }
    }

    const avgResponseTime =
      responseTimes.length > 0
        ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
        : null;

    // Format response time
    const avgResponseTimeText = formatResponseTime(avgResponseTime);

    // Response rate: how many customer messages got a response
    const responseRate =
      customerMessages.length > 0
        ? (responseTimes.length / customerMessages.length) * 100
        : 0;

    return {
      avgResponseTime,
      avgResponseTimeText,
      totalMessages: messages.length,
      customerMessages: customerMessages.length,
      supportMessages: supportMessages.length,
      botMessages: botMessages.length,
      responseRate: Math.round(responseRate),
    };
  }, [messages]);
}

/**
 * Calculate global statistics across all rooms
 */
export function useGlobalChatStats(rooms: LiveChatRoom[]): GlobalChatStats {
  return useMemo(() => {
    const activeRooms = rooms.filter((r) => r.status === "active").length;
    const waitingRooms = rooms.filter((r) => r.status === "waiting").length;
    const closedRooms = rooms.filter((r) => r.status === "closed").length;
    const totalUnread = rooms.reduce((acc, r) => acc + (r.unread_count || 0), 0);

    return {
      avgResponseTime: null, // Would need all messages to calculate
      avgResponseTimeText: "N/A",
      totalRooms: rooms.length,
      activeRooms,
      waitingRooms,
      closedRooms,
      totalUnread,
    };
  }, [rooms]);
}

/**
 * Format response time in human readable format
 */
export function formatResponseTime(seconds: number | null): string {
  if (seconds === null) return "N/A";

  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return secs > 0 ? `${minutes}m ${secs}s` : `${minutes}m`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.round((seconds % 3600) / 60);
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
}
