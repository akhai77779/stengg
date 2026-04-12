import { LiveChatAdminPanel } from "@/components/admin/LiveChatAdminPanel";

export default function AdminLiveChat() {
  return (
     <div className="h-[calc(100vh-10rem)] md:h-[calc(100vh-14rem)] min-h-[400px]">
       <LiveChatAdminPanel isEmbedded />
    </div>
  );
}
