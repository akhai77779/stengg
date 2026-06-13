import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CHAT_ATTACHMENT_TTL } from "@/lib/storageUrls";

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
  delivered_at: string | null;
  created_at: string;
}

interface UseLiveChatMessagesOptions {
  onNewMessage?: (message: LiveChatMessage) => void;
  /** When > 0, poll the messages query at this interval (ms). Useful for
   *  anonymous guests where realtime postgres_changes is not available. */
  pollMs?: number;
}

export function useLiveChatMessages(
  roomId: string | null,
  options: UseLiveChatMessagesOptions = {}
) {
  const { onNewMessage, pollMs } = options;
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
    refetchInterval: pollMs && pollMs > 0 ? pollMs : false,
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

      if (error) {
        console.error("[live-chat] INSERT message failed", {
          message: error.message,
          code: (error as { code?: string }).code,
          details: (error as { details?: string }).details,
          hint: (error as { hint?: string }).hint,
          payload: {
            room_id: data.room_id,
            sender_type: data.sender_type,
            sender_id: data.sender_id,
          },
        });
        throw error;
      }

      // Update room's last message
      const { error: roomErr } = await supabase
        .from("live_chat_rooms")
        .update({
          last_message: data.message || data.attachment_name || "Tệp đính kèm",
          last_updated_at: new Date().toISOString(),
          status: "active",
        })
        .eq("id", data.room_id);
      if (roomErr) {
        console.warn("[live-chat] UPDATE room.last_message failed", {
          message: roomErr.message,
          code: (roomErr as { code?: string }).code,
          details: (roomErr as { details?: string }).details,
          hint: (roomErr as { hint?: string }).hint,
        });
        // Do not throw — the message itself was inserted successfully.
      }

      return message as LiveChatMessage;
    },
    onSuccess: (newMessage) => {
      queryClient.invalidateQueries({
        queryKey: ["live-chat-messages", roomId],
      });
      queryClient.invalidateQueries({ queryKey: ["live-chat-rooms"] });
    },
    onError: (error: unknown) => {
      const e = error as { message?: string; code?: string; details?: string; hint?: string };
      const reason = e?.message || "Lỗi không xác định";
      toast({
        title: "Không thể gửi tin nhắn",
        description: reason,
        variant: "destructive",
      });
      console.error("[live-chat] Send message error:", {
        message: e?.message,
        code: e?.code,
        details: e?.details,
        hint: e?.hint,
        raw: error,
      });
    },
  });

  // Edit message mutation
  const editMessage = useMutation({
    mutationFn: async ({ messageId, newMessage }: { messageId: string; newMessage: string }) => {
      if (!roomId) throw new Error("No room ID");
      
      const { data, error } = await supabase
        .from("live_chat_messages")
        .update({ message: newMessage })
        .eq("id", messageId)
        .eq("room_id", roomId)
        .select()
        .single();

      if (error) throw error;
      return data as LiveChatMessage;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["live-chat-messages", roomId],
      });
      toast({
        title: "Đã sửa",
        description: "Tin nhắn đã được cập nhật",
      });
    },
    onError: (error) => {
      toast({
        title: "Lỗi",
        description: "Không thể sửa tin nhắn",
        variant: "destructive",
      });
      console.error("Edit message error:", error);
    },
  });

  // Delete message mutation
  const deleteMessage = useMutation({
    mutationFn: async (messageId: string) => {
      if (!roomId) throw new Error("No room ID");
      
      const { error } = await supabase
        .from("live_chat_messages")
        .delete()
        .eq("id", messageId)
        .eq("room_id", roomId);

      if (error) throw error;
      return messageId;
    },
    onSuccess: (deletedId) => {
      // Optimistically remove from cache
      queryClient.setQueryData(
        ["live-chat-messages", roomId],
        (old: LiveChatMessage[] = []) => old.filter((m) => m.id !== deletedId)
      );
      queryClient.invalidateQueries({ queryKey: ["live-chat-rooms"] });
      toast({
        title: "Đã xóa",
        description: "Tin nhắn đã được xóa",
      });
    },
    onError: (error) => {
      toast({
        title: "Lỗi",
        description: "Không thể xóa tin nhắn",
        variant: "destructive",
      });
      console.error("Delete message error:", error);
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
          delivered_at: new Date().toISOString(),
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

  // Mark incoming messages as delivered (ticked but not necessarily read).
  // Pass the senderType of incoming messages (e.g., 'support' for customer view).
  const markDelivered = useMutation({
    mutationFn: async (senderTypes: Array<"customer" | "support" | "bot">) => {
      if (!roomId || senderTypes.length === 0) return;
      const { error } = await supabase
        .from("live_chat_messages")
        .update({ delivered_at: new Date().toISOString() })
        .eq("room_id", roomId)
        .in("sender_type", senderTypes)
        .is("delivered_at", null);
      if (error) {
        console.warn("[markDelivered]", error);
      }
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

      // Bucket is private — generate a short-lived signed URL for immediate
      // display. The path is what we persist on the message so that any
      // consumer can re-sign it later via signUploadsUrl().
      const { data: signed, error: signError } = await supabase.storage
        .from("uploads")
        .createSignedUrl(filePath, CHAT_ATTACHMENT_TTL);
      if (signError) throw signError;

      const isImage = file.type.startsWith("image/");

      return {
        // Persist the storage PATH (not the time-limited signed URL) so that
        // historical messages can always be re-signed on display.
        url: filePath,
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
        (payload) => {
          const updatedMessage = payload.new as LiveChatMessage;
          queryClient.setQueryData(
            ["live-chat-messages", roomId],
            (old: LiveChatMessage[] = []) =>
              old.map((m) => (m.id === updatedMessage.id ? updatedMessage : m))
          );
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "live_chat_messages",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          const deletedMessage = payload.old as { id: string };
          queryClient.setQueryData(
            ["live-chat-messages", roomId],
            (old: LiveChatMessage[] = []) =>
              old.filter((m) => m.id !== deletedMessage.id)
          );
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
    editMessage: editMessage.mutate,
    editMessageAsync: editMessage.mutateAsync,
    deleteMessage: deleteMessage.mutate,
    deleteMessageAsync: deleteMessage.mutateAsync,
    markAsRead: markAsRead.mutate,
    markDelivered: markDelivered.mutate,
    uploadAttachment,
    isSending: sendMessage.isPending,
    isEditing: editMessage.isPending,
    isDeleting: deleteMessage.isPending,
    unreadCount,
  };
}
