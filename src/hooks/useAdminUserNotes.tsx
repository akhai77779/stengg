 import { useState, useEffect, useCallback } from 'react';
 import { supabase } from '@/integrations/supabase/client';
 import { useToast } from '@/hooks/use-toast';
 
 export interface AdminUserNote {
   id: string;
   user_id: string;
   note: string;
   created_by: string;
   created_at: string;
   updated_at: string;
 }
 
 export function useAdminUserNotes() {
   const [notes, setNotes] = useState<Record<string, AdminUserNote>>({});
   const [isLoading, setIsLoading] = useState(true);
   const { toast } = useToast();
 
   const fetchNotes = useCallback(async () => {
     setIsLoading(true);
     const { data, error } = await supabase
       .from('admin_user_notes')
       .select('*');
 
     if (error) {
       console.error('Error fetching admin notes:', error);
     } else if (data) {
       const notesMap: Record<string, AdminUserNote> = {};
       data.forEach((note) => {
         notesMap[note.user_id] = note as AdminUserNote;
       });
       setNotes(notesMap);
     }
     setIsLoading(false);
   }, []);
 
   useEffect(() => {
     fetchNotes();
   }, [fetchNotes]);
 
   const saveNote = useCallback(async (userId: string, noteText: string): Promise<boolean> => {
     try {
       const { data: { user } } = await supabase.auth.getUser();
       if (!user) {
         toast({ title: 'Lỗi', description: 'Không tìm thấy phiên đăng nhập', variant: 'destructive' });
         return false;
       }
 
       const existingNote = notes[userId];
 
       if (existingNote) {
         // Update existing note
         const { error } = await supabase
           .from('admin_user_notes')
           .update({ note: noteText, updated_at: new Date().toISOString() })
           .eq('user_id', userId);
 
         if (error) {
           toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
           return false;
         }
 
         setNotes(prev => ({
           ...prev,
           [userId]: { ...prev[userId], note: noteText, updated_at: new Date().toISOString() }
         }));
       } else {
         // Insert new note
         const { data, error } = await supabase
           .from('admin_user_notes')
           .insert({
             user_id: userId,
             note: noteText,
             created_by: user.id
           })
           .select()
           .single();
 
         if (error) {
           toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
           return false;
         }
 
         if (data) {
           setNotes(prev => ({
             ...prev,
             [userId]: data as AdminUserNote
           }));
         }
       }
 
       toast({ title: 'Thành công', description: 'Đã lưu ghi chú' });
       return true;
     } catch (err) {
       console.error('Error saving note:', err);
       toast({ title: 'Lỗi', description: 'Không thể lưu ghi chú', variant: 'destructive' });
       return false;
     }
   }, [notes, toast]);
 
   const deleteNote = useCallback(async (userId: string): Promise<boolean> => {
     try {
       const { error } = await supabase
         .from('admin_user_notes')
         .delete()
         .eq('user_id', userId);
 
       if (error) {
         toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
         return false;
       }
 
       setNotes(prev => {
         const newNotes = { ...prev };
         delete newNotes[userId];
         return newNotes;
       });
 
       toast({ title: 'Thành công', description: 'Đã xóa ghi chú' });
       return true;
     } catch (err) {
       console.error('Error deleting note:', err);
       toast({ title: 'Lỗi', description: 'Không thể xóa ghi chú', variant: 'destructive' });
       return false;
     }
   }, [toast]);
 
   return {
     notes,
     isLoading,
     saveNote,
     deleteNote,
     refetch: fetchNotes
   };
 }