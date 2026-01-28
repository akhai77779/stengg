import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface LiveChatNote {
  id: string;
  room_id: string;
  content: string;
  author_id: string | null;
  author_name: string;
  author_email: string | null;
  created_at: string;
  updated_at: string;
}

export function useLiveChatNotes(roomId: string | null) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch notes for room
  const {
    data: notes = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["live-chat-notes", roomId],
    queryFn: async () => {
      if (!roomId) return [];

      const { data, error } = await supabase
        .from("live_chat_notes")
        .select("*")
        .eq("room_id", roomId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as LiveChatNote[];
    },
    enabled: !!roomId,
  });

  // Create note mutation
  const createNote = useMutation({
    mutationFn: async (data: {
      room_id: string;
      content: string;
      author_id: string;
      author_name: string;
      author_email?: string;
    }) => {
      const { data: note, error } = await supabase
        .from("live_chat_notes")
        .insert({
          room_id: data.room_id,
          content: data.content,
          author_id: data.author_id,
          author_name: data.author_name,
          author_email: data.author_email || null,
        })
        .select()
        .single();

      if (error) throw error;
      return note as LiveChatNote;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["live-chat-notes", roomId],
      });
      toast({
        title: "Đã lưu",
        description: "Ghi chú đã được lưu",
      });
    },
    onError: (error) => {
      toast({
        title: "Lỗi",
        description: "Không thể lưu ghi chú",
        variant: "destructive",
      });
      console.error("Create note error:", error);
    },
  });

  // Update note mutation
  const updateNote = useMutation({
    mutationFn: async (data: { id: string; content: string }) => {
      const { data: note, error } = await supabase
        .from("live_chat_notes")
        .update({
          content: data.content,
          updated_at: new Date().toISOString(),
        })
        .eq("id", data.id)
        .select()
        .single();

      if (error) throw error;
      return note as LiveChatNote;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["live-chat-notes", roomId],
      });
      toast({
        title: "Đã cập nhật",
        description: "Ghi chú đã được cập nhật",
      });
    },
    onError: (error) => {
      toast({
        title: "Lỗi",
        description: "Không thể cập nhật ghi chú",
        variant: "destructive",
      });
      console.error("Update note error:", error);
    },
  });

  // Delete note mutation
  const deleteNote = useMutation({
    mutationFn: async (noteId: string) => {
      const { error } = await supabase
        .from("live_chat_notes")
        .delete()
        .eq("id", noteId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["live-chat-notes", roomId],
      });
      toast({
        title: "Đã xóa",
        description: "Ghi chú đã được xóa",
      });
    },
    onError: (error) => {
      toast({
        title: "Lỗi",
        description: "Không thể xóa ghi chú",
        variant: "destructive",
      });
      console.error("Delete note error:", error);
    },
  });

  return {
    notes,
    isLoading,
    error,
    refetch,
    createNote: createNote.mutate,
    updateNote: updateNote.mutate,
    deleteNote: deleteNote.mutate,
    isCreating: createNote.isPending,
    isUpdating: updateNote.isPending,
    isDeleting: deleteNote.isPending,
  };
}
