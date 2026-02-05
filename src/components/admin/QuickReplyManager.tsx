 import { useState } from "react";
 import { useQuickReplyTemplates, QuickReplyTemplate } from "@/hooks/useQuickReplyTemplates";
 import { Button } from "@/components/ui/button";
 import { Input } from "@/components/ui/input";
 import { Textarea } from "@/components/ui/textarea";
 import { Switch } from "@/components/ui/switch";
 import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
 import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
 import { Plus, Pencil, Trash2, Hash, Settings } from "lucide-react";
 import { Badge } from "@/components/ui/badge";
 import { Skeleton } from "@/components/ui/skeleton";
 
 interface QuickReplyManagerProps {
   open: boolean;
   onOpenChange: (open: boolean) => void;
 }
 
 export function QuickReplyManager({ open, onOpenChange }: QuickReplyManagerProps) {
   const { templates, loading, addTemplate, updateTemplate, deleteTemplate, toggleActive } = useQuickReplyTemplates();
   const [editingTemplate, setEditingTemplate] = useState<QuickReplyTemplate | null>(null);
   const [isAddMode, setIsAddMode] = useState(false);
   const [formTag, setFormTag] = useState("");
   const [formText, setFormText] = useState("");
   const [saving, setSaving] = useState(false);
 
   const handleOpenAdd = () => {
     setEditingTemplate(null);
     setIsAddMode(true);
     setFormTag("");
     setFormText("");
   };
 
   const handleOpenEdit = (template: QuickReplyTemplate) => {
     setEditingTemplate(template);
     setIsAddMode(false);
     setFormTag(template.tag);
     setFormText(template.text);
   };
 
   const handleClose = () => {
     setEditingTemplate(null);
     setIsAddMode(false);
     setFormTag("");
     setFormText("");
   };
 
   const handleSave = async () => {
     if (!formTag.trim() || !formText.trim()) return;
     setSaving(true);
 
     const cleanTag = formTag.replace(/^#/, "").trim().toLowerCase();
 
     if (isAddMode) {
       await addTemplate(cleanTag, formText.trim());
     } else if (editingTemplate) {
       await updateTemplate(editingTemplate.id, cleanTag, formText.trim());
     }
 
     setSaving(false);
     handleClose();
   };
 
   const handleDelete = async (id: string) => {
     if (confirm("Bạn có chắc muốn xóa mẫu trả lời này?")) {
       await deleteTemplate(id);
     }
   };
 
   const isEditing = isAddMode || editingTemplate !== null;
 
   return (
     <Dialog open={open} onOpenChange={onOpenChange}>
       <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
         <DialogHeader>
           <DialogTitle className="flex items-center gap-2">
             <Settings className="h-5 w-5" />
             Quản lý mẫu trả lời nhanh
           </DialogTitle>
         </DialogHeader>
 
         {/* Add/Edit Form */}
         {isEditing && (
           <div className="border rounded-lg p-4 bg-muted/50 space-y-3">
             <div className="flex items-center gap-2">
               <Hash className="h-4 w-4 text-muted-foreground" />
               <Input
                 placeholder="Tag (vd: greeting)"
                 value={formTag}
                 onChange={(e) => setFormTag(e.target.value)}
                 className="flex-1 h-9"
               />
             </div>
             <Textarea
               placeholder="Nội dung tin nhắn..."
               value={formText}
               onChange={(e) => setFormText(e.target.value)}
               rows={3}
             />
             <div className="flex justify-end gap-2">
               <Button variant="outline" size="sm" onClick={handleClose}>
                 Hủy
               </Button>
               <Button size="sm" onClick={handleSave} disabled={saving || !formTag.trim() || !formText.trim()}>
                 {saving ? "Đang lưu..." : isAddMode ? "Thêm" : "Cập nhật"}
               </Button>
             </div>
           </div>
         )}
 
         {/* Templates List */}
         <div className="flex-1 overflow-y-auto min-h-0">
           {loading ? (
             <div className="space-y-2">
               {[1, 2, 3].map((i) => (
                 <Skeleton key={i} className="h-16 w-full" />
               ))}
             </div>
           ) : templates.length === 0 ? (
             <div className="text-center py-8 text-muted-foreground">
               Chưa có mẫu trả lời nào
             </div>
           ) : (
             <Table>
               <TableHeader>
                 <TableRow>
                   <TableHead className="w-24">Tag</TableHead>
                   <TableHead>Nội dung</TableHead>
                   <TableHead className="w-20">Trạng thái</TableHead>
                   <TableHead className="w-24 text-right">Thao tác</TableHead>
                 </TableRow>
               </TableHeader>
               <TableBody>
                 {templates.map((template) => (
                   <TableRow key={template.id}>
                     <TableCell>
                       <Badge variant="outline" className="font-mono">
                         #{template.tag}
                       </Badge>
                     </TableCell>
                     <TableCell className="max-w-[300px]">
                       <p className="text-sm line-clamp-2">{template.text}</p>
                     </TableCell>
                     <TableCell>
                       <Switch
                         checked={template.is_active}
                         onCheckedChange={(checked) => toggleActive(template.id, checked)}
                       />
                     </TableCell>
                     <TableCell className="text-right">
                       <div className="flex justify-end gap-1">
                         <Button
                           variant="ghost"
                           size="icon"
                           className="h-8 w-8"
                           onClick={() => handleOpenEdit(template)}
                         >
                           <Pencil className="h-4 w-4" />
                         </Button>
                         <Button
                           variant="ghost"
                           size="icon"
                           className="h-8 w-8 text-destructive hover:text-destructive"
                           onClick={() => handleDelete(template.id)}
                         >
                           <Trash2 className="h-4 w-4" />
                         </Button>
                       </div>
                     </TableCell>
                   </TableRow>
                 ))}
               </TableBody>
             </Table>
           )}
         </div>
 
         <DialogFooter>
           {!isEditing && (
             <Button onClick={handleOpenAdd} className="gap-2">
               <Plus className="h-4 w-4" />
               Thêm mẫu mới
             </Button>
           )}
         </DialogFooter>
       </DialogContent>
     </Dialog>
   );
 }