 import { useState, useEffect } from "react";
 import { supabase } from "@/integrations/supabase/client";
 import { toast } from "sonner";
 
 export interface QuickReplyTemplate {
   id: string;
   tag: string;
   text: string;
   display_order: number;
   is_active: boolean;
   created_at: string;
 }
 
 export function useQuickReplyTemplates() {
   const [templates, setTemplates] = useState<QuickReplyTemplate[]>([]);
   const [loading, setLoading] = useState(true);
 
   const fetchTemplates = async () => {
     setLoading(true);
     const { data, error } = await supabase
       .from("quick_reply_templates")
       .select("*")
       .order("display_order", { ascending: true });
 
     if (error) {
       console.error("Error fetching templates:", error);
     } else {
       setTemplates(data || []);
     }
     setLoading(false);
   };
 
   useEffect(() => {
     fetchTemplates();
   }, []);
 
   const addTemplate = async (tag: string, text: string) => {
     const maxOrder = templates.length > 0 
       ? Math.max(...templates.map(t => t.display_order)) + 1 
       : 1;
 
     const { error } = await supabase
       .from("quick_reply_templates")
       .insert({ tag, text, display_order: maxOrder });
 
     if (error) {
       toast.error("Lỗi khi thêm mẫu trả lời");
       return false;
     }
     toast.success("Đã thêm mẫu trả lời mới");
     fetchTemplates();
     return true;
   };
 
   const updateTemplate = async (id: string, tag: string, text: string) => {
     const { error } = await supabase
       .from("quick_reply_templates")
       .update({ tag, text })
       .eq("id", id);
 
     if (error) {
       toast.error("Lỗi khi cập nhật mẫu");
       return false;
     }
     toast.success("Đã cập nhật mẫu trả lời");
     fetchTemplates();
     return true;
   };
 
   const deleteTemplate = async (id: string) => {
     const { error } = await supabase
       .from("quick_reply_templates")
       .delete()
       .eq("id", id);
 
     if (error) {
       toast.error("Lỗi khi xóa mẫu");
       return false;
     }
     toast.success("Đã xóa mẫu trả lời");
     fetchTemplates();
     return true;
   };
 
   const toggleActive = async (id: string, isActive: boolean) => {
     const { error } = await supabase
       .from("quick_reply_templates")
       .update({ is_active: isActive })
       .eq("id", id);
 
     if (error) {
       toast.error("Lỗi khi thay đổi trạng thái");
       return false;
     }
     fetchTemplates();
     return true;
   };
 
   return {
     templates,
     loading,
     addTemplate,
     updateTemplate,
     deleteTemplate,
     toggleActive,
     refetch: fetchTemplates,
   };
 }