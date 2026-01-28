import { useState, useEffect, useCallback } from "react";
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
  const { autoRefresh = true, refreshInterval = 5000 } = options;
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});

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
  });

  // Fetch unread counts for each room
  const fetchUnreadCounts = useCallback(async () => {
    if (!rooms.length) return;

    const counts: Record<string, number> = {};

    for (const room of rooms) {
      const { count } = await supabase
        .from("live_chat_messages")
        .select("*", { count: "exact", head: true })
        .eq("room_id", room.id)
        .eq("sender_type", "customer")
        .eq("is_read", false);

      counts[room.id] = count || 0;
    }

    setUnreadCounts(counts);
  }, [rooms]);

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
        .single();

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

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
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

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

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
