 import { useState, useEffect } from 'react';
 import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
 import { Button } from '@/components/ui/button';
 import { Textarea } from '@/components/ui/textarea';
 import { Label } from '@/components/ui/label';
 import { Loader2, StickyNote, Trash2 } from 'lucide-react';
 import { format } from 'date-fns';
 import { AdminUserNote } from '@/hooks/useAdminUserNotes';
 
 interface Profile {
   id: string;
   full_name: string | null;
   email: string | null;
   user_code: number | null;
 }
 
 interface AdminUserNoteDialogProps {
   user: Profile | null;
   note: AdminUserNote | null;
   open: boolean;
   onOpenChange: (open: boolean) => void;
   onSave: (userId: string, note: string) => Promise<boolean>;
   onDelete: (userId: string) => Promise<boolean>;
 }
 
 export function AdminUserNoteDialog({
   user,
   note,
   open,
   onOpenChange,
   onSave,
   onDelete
 }: AdminUserNoteDialogProps) {
   const [noteText, setNoteText] = useState('');
   const [isSaving, setIsSaving] = useState(false);
   const [isDeleting, setIsDeleting] = useState(false);
 
   useEffect(() => {
     if (note) {
       setNoteText(note.note);
     } else {
       setNoteText('');
     }
   }, [note, user]);
 
   const getUserCode = (profile: Profile) => {
     return profile.user_code?.toString().padStart(5, '0') || '-----';
   };
 
   const handleSave = async () => {
     if (!user) return;
     
     setIsSaving(true);
     const success = await onSave(user.id, noteText);
     setIsSaving(false);
     
     if (success) {
       onOpenChange(false);
     }
   };
 
   const handleDelete = async () => {
     if (!user) return;
     
     setIsDeleting(true);
     const success = await onDelete(user.id);
     setIsDeleting(false);
     
     if (success) {
       setNoteText('');
       onOpenChange(false);
     }
   };
 
   return (
     <Dialog open={open} onOpenChange={onOpenChange}>
       <DialogContent className="sm:max-w-lg">
         <DialogHeader>
           <DialogTitle className="flex items-center gap-2">
             <StickyNote className="w-5 h-5 text-yellow-500" />
             Ghi chú Admin
           </DialogTitle>
           <DialogDescription>
             Ghi chú cho {user?.full_name || user?.email || 'Người dùng'} (ID: {user && getUserCode(user)})
           </DialogDescription>
         </DialogHeader>
         
         <div className="space-y-4">
           <div className="space-y-2">
             <Label htmlFor="adminNote">Nội dung ghi chú (chỉ admin mới thấy)</Label>
             <Textarea
               id="adminNote"
               value={noteText}
               onChange={(e) => setNoteText(e.target.value)}
               placeholder="Nhập ghi chú về người dùng này..."
               rows={5}
               className="resize-none"
             />
           </div>
           
           {note && (
             <div className="text-xs text-muted-foreground">
               <p>Cập nhật lần cuối: {format(new Date(note.updated_at), 'dd/MM/yyyy HH:mm')}</p>
             </div>
           )}
           
           <div className="bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 p-3 rounded-lg text-sm">
             <p className="font-medium">Lưu ý:</p>
             <p>Ghi chú này chỉ hiển thị cho admin, người dùng sẽ không thấy được.</p>
           </div>
         </div>
 
         <DialogFooter className="gap-2 sm:gap-0">
           {note && (
             <Button
               variant="outline"
               onClick={handleDelete}
               disabled={isDeleting || isSaving}
               className="text-destructive hover:text-destructive mr-auto"
             >
               {isDeleting ? (
                 <Loader2 className="w-4 h-4 mr-2 animate-spin" />
               ) : (
                 <Trash2 className="w-4 h-4 mr-2" />
               )}
               Xóa ghi chú
             </Button>
           )}
           <Button variant="outline" onClick={() => onOpenChange(false)}>
             Hủy
           </Button>
           <Button 
             onClick={handleSave} 
             disabled={isSaving || isDeleting}
             className="bg-yellow-500 hover:bg-yellow-600 text-black"
           >
             {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
             Lưu ghi chú
           </Button>
         </DialogFooter>
       </DialogContent>
     </Dialog>
   );
 }