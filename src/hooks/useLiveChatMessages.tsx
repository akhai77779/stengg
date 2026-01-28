import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface LiveChatMessage {
  id: string;
  room_id: string;
  sender_type: "customer" | "support" | "bot";
  sender_id: string | null;
  sender_name: string;
  message: string;
  attachment_url: string | null;
  attachment_type: "image" | "file" | null;
  attachment_name: string | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

interface UseLiveChatMessagesOptions {
  onNewMessage?: (message: LiveChatMessage) => void;
}

export function useLiveChatMessages(
  roomId: string | null,
  options: UseLiveChatMessagesOptions = {}
) {
  const { onNewMessage } = options;
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const lastMessageIdRef = useRef<string | null>(null);

  // Fetch messages for room
  const {
    data: messages = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["live-chat-messages", roomId],
    queryFn: async () => {
      if (!roomId) return [];

      const { data, error } = await supabase
        .from("live_chat_messages")
        .select("*")
        .eq("room_id", roomId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data as LiveChatMessage[];
    },
    enabled: !!roomId,
  });

  // Send message mutation
  const sendMessage = useMutation({
    mutationFn: async (data: {
      room_id: string;
      sender_type: "customer" | "support" | "bot";
      sender_id?: string;
      sender_name: string;
      message: string;
      attachment_url?: string;
      attachment_type?: "image" | "file";
      attachment_name?: string;
    }) => {
      const { data: message, error } = await supabase
        .from("live_chat_messages")
        .insert({
          room_id: data.room_id,
          sender_type: data.sender_type,
          sender_id: data.sender_id || null,
          sender_name: data.sender_name,
          message: data.message,
          attachment_url: data.attachment_url || null,
          attachment_type: data.attachment_type || null,
          attachment_name: data.attachment_name || null,
          is_read: false,
        })
        .select()
        .single();

      if (error) throw error;

      // Update room's last message
      await supabase
        .from("live_chat_rooms")
        .update({
          last_message: data.message || data.attachment_name || "Tệp đính kèm",
          last_updated_at: new Date().toISOString(),
          status: "active",
        })
        .eq("id", data.room_id);

      return message as LiveChatMessage;
    },
    onSuccess: (newMessage) => {
      queryClient.invalidateQueries({
        queryKey: ["live-chat-messages", roomId],
      });
      queryClient.invalidateQueries({ queryKey: ["live-chat-rooms"] });
    },
    onError: (error) => {
      toast({
        title: "Lỗi",
        description: "Không thể gửi tin nhắn",
        variant: "destructive",
      });
      console.error("Send message error:", error);
    },
  });

  // Mark messages as read
  const markAsRead = useMutation({
    mutationFn: async (senderType: "customer" | "support") => {
      if (!roomId) return;

      const { error } = await supabase
        .from("live_chat_messages")
        .update({
          is_read: true,
          read_at: new Date().toISOString(),
        })
        .eq("room_id", roomId)
        .eq("sender_type", senderType)
        .eq("is_read", false);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["live-chat-messages", roomId],
      });
    },
  });

  // Upload attachment
  const uploadAttachment = useCallback(
    async (file: File): Promise<{ url: string; type: "image" | "file"; name: string }> => {
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `live-chat/${roomId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("uploads")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("uploads")
        .getPublicUrl(filePath);

      const isImage = file.type.startsWith("image/");

      return {
        url: urlData.publicUrl,
        type: isImage ? "image" : "file",
        name: file.name,
      };
    },
    [roomId]
  );

  // Realtime subscription for messages
  useEffect(() => {
    if (!roomId) return;

    const channel = supabase
      .channel(`messages-${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "live_chat_messages",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          const newMessage = payload.new as LiveChatMessage;

          // Avoid duplicate notifications
          if (lastMessageIdRef.current !== newMessage.id) {
            lastMessageIdRef.current = newMessage.id;

            // Add to cache optimistically
            queryClient.setQueryData(
              ["live-chat-messages", roomId],
              (old: LiveChatMessage[] = []) => {
                if (old.some((m) => m.id === newMessage.id)) return old;
                return [...old, newMessage];
              }
            );

            // Callback for new message
            onNewMessage?.(newMessage);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "live_chat_messages",
          filter: `room_id=eq.${roomId}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: ["live-chat-messages", roomId],
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, queryClient, onNewMessage]);

  // Unread count
  const unreadCount = messages.filter((m) => !m.is_read).length;

  return {
    messages,
    isLoading,
    error,
    refetch,
    sendMessage: sendMessage.mutate,
    sendMessageAsync: sendMessage.mutateAsync,
    markAsRead: markAsRead.mutate,
    uploadAttachment,
    isSending: sendMessage.isPending,
    unreadCount,
  };
}
