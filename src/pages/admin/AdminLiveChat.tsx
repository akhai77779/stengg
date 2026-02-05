import { LiveChatAdminPanel } from "@/components/admin/LiveChatAdminPanel";

export default function AdminLiveChat() {
  return (
     <div className="h-[calc(100vh-14rem)] min-h-[500px]">
       <LiveChatAdminPanel isEmbedded />
    </div>
  );
}
