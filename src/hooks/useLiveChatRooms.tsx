import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface LiveChatRoom {
  id: string;
  customer_id: string;
  customer_name: string;
  customer_email: string | null;
  status: "active" | "waiting" | "closed";
  assigned_to: string | null;
  last_message: string | null;
  last_updated_at: string;
  created_at: string;
  updated_at: string;
  unread_count?: number;
}

interface UseLiveChatRoomsOptions {
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export function useLiveChatRooms(options: UseLiveChatRoomsOptions = {}) {
  const { autoRefresh = true, refreshInterval = 30000 } = options; // Increased to 30s since we use realtime
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const lastFetchRef = useRef<number>(0);

  // Fetch all rooms (admin)
  const {
    data: rooms = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["live-chat-rooms"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("live_chat_rooms")
        .select("*")
        .order("last_updated_at", { ascending: false });

      if (error) throw error;
      return data as LiveChatRoom[];
    },
    refetchInterval: autoRefresh ? refreshInterval : false,
    staleTime: 10000, // Consider data fresh for 10s
  });

  // Fetch unread counts efficiently using a single aggregated query
  const fetchUnreadCounts = useCallback(async () => {
    if (!rooms.length) return;

    // Debounce: prevent fetching more than once per second
    const now = Date.now();
    if (now - lastFetchRef.current < 1000) return;
    lastFetchRef.current = now;

    try {
      // Fetch all unread messages in a single query and group by room_id in JS
      const roomIds = rooms.map(r => r.id);
      const { data: unreadMessages, error } = await supabase
        .from("live_chat_messages")
        .select("room_id")
        .in("room_id", roomIds)
        .eq("sender_type", "customer")
        .eq("is_read", false);

      if (error) {
        console.error("Error fetching unread counts:", error);
        return;
      }

      // Count messages per room
      const counts: Record<string, number> = {};
      roomIds.forEach(id => { counts[id] = 0; });
      
      (unreadMessages || []).forEach(msg => {
        counts[msg.room_id] = (counts[msg.room_id] || 0) + 1;
      });

      setUnreadCounts(counts);
    } catch (err) {
      console.error("Error in fetchUnreadCounts:", err);
    }
  }, [rooms]);

  // Fetch unread counts when rooms change
  useEffect(() => {
    fetchUnreadCounts();
  }, [fetchUnreadCounts]);

  // Create room mutation
  const createRoom = useMutation({
    mutationFn: async (data: {
      customer_id: string;
      customer_name: string;
      customer_email?: string;
    }) => {
      const { data: room, error } = await supabase
        .from("live_chat_rooms")
        .insert({
          customer_id: data.customer_id,
          customer_name: data.customer_name,
          customer_email: data.customer_email || null,
          status: "waiting",
        })
        .select()
        .single();

      if (error) throw error;
      return room as LiveChatRoom;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["live-chat-rooms"] });
    },
    onError: (error) => {
      toast({
        title: "Lỗi",
        description: "Không thể tạo phòng chat",
        variant: "destructive",
      });
      console.error("Create room error:", error);
    },
  });

  // Update room mutation
  const updateRoom = useMutation({
    mutationFn: async (data: {
      id: string;
      status?: "active" | "waiting" | "closed";
      assigned_to?: string | null;
      last_message?: string;
    }) => {
      const { id, ...updates } = data;
      const { data: room, error } = await supabase
        .from("live_chat_rooms")
        .update({
          ...updates,
          last_updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return room as LiveChatRoom;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["live-chat-rooms"] });
    },
  });

  // Find or create room for customer
  const findOrCreateRoom = useCallback(
    async (customer: {
      id: string;
      name: string;
      email?: string;
    }): Promise<LiveChatRoom> => {
      // Find existing active room
      const { data: existingRoom } = await supabase
        .from("live_chat_rooms")
        .select("*")
        .eq("customer_id", customer.id)
        .neq("status", "closed")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingRoom) {
        return existingRoom as LiveChatRoom;
      }

      // Create new room
      const room = await createRoom.mutateAsync({
        customer_id: customer.id,
        customer_name: customer.name,
        customer_email: customer.email,
      });

      return room;
    },
    [createRoom]
  );

  // Realtime subscription for rooms AND messages (to update unread counts)
  useEffect(() => {
    const roomChannel = supabase
      .channel("live-chat-rooms-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "live_chat_rooms",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["live-chat-rooms"] });
        }
      )
      .subscribe();

    // Subscribe to message changes to update unread counts in realtime
    const messageChannel = supabase
      .channel("live-chat-messages-unread")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "live_chat_messages",
        },
        (payload) => {
          // Refresh unread counts when messages change
          // Use a small delay to batch rapid updates
          setTimeout(() => {
            fetchUnreadCounts();
          }, 100);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(roomChannel);
      supabase.removeChannel(messageChannel);
    };
  }, [queryClient, fetchUnreadCounts]);

  // Rooms with unread counts
  const roomsWithUnread = rooms.map((room) => ({
    ...room,
    unread_count: unreadCounts[room.id] || 0,
  }));

  // Total unread count
  const totalUnread = Object.values(unreadCounts).reduce((a, b) => a + b, 0);

  return {
    rooms: roomsWithUnread,
    isLoading,
    error,
    refetch,
    createRoom: createRoom.mutate,
    updateRoom: updateRoom.mutate,
    findOrCreateRoom,
    totalUnread,
    isCreating: createRoom.isPending,
    isUpdating: updateRoom.isPending,
  };
}
