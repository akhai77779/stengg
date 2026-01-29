import { useEffect, useState } from "react";
import { MessageCircle, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useLiveChatMessages } from "@/hooks/useLiveChatMessages";
import { useAuth } from "@/hooks/useAuth";
import { useLiveChat } from "@/contexts/LiveChatContext";

/**
 * Mobile-only CSKH button in header.
 * Opens the global live chat overlay.
 */
export function SupportMenuButton() {
  const { openChat } = useLiveChat();
  const [supportEnabled, setSupportEnabled] = useState(true);
  const [roomId, setRoomId] = useState<string | null>(null);

  const { user } = useAuth();

  const { messages } = useLiveChatMessages(roomId);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const { data, error } = await supabase
          .from("app_settings")
          .select("key,value")
          .in("key", ["support_enabled"]);

        if (error) throw error;

        const map = new Map<string, unknown>();
        (data ?? []).forEach((row) => map.set(row.key, row.value));

        const support = map.get("support_enabled") as { enabled?: boolean } | undefined;

        if (!mounted) return;
        setSupportEnabled(Boolean(support?.enabled ?? true));
      } catch (e) {
        console.warn("SupportMenuButton: cannot load settings", e);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, []);

  // Load room ID for unread count
  useEffect(() => {
    if (!user?.id) return;
    
    const loadRoom = async () => {
      const { data } = await supabase
        .from("live_chat_rooms")
        .select("id")
        .eq("customer_id", user.id)
        .maybeSingle();
      
      if (data) setRoomId(data.id);
    };
    
    loadRoom();
  }, [user?.id]);

  // Unread count from support
  const unreadCount = messages.filter(
    (m) => (m.sender_type === "support" || m.sender_type === "bot") && !m.is_read
  ).length;

  if (!supportEnabled) return null;

  return (
    <Button
      variant="ghost"
      size="icon"
      className="md:hidden relative"
      onClick={openChat}
    >
      <span className="relative">
        <MessageCircle className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-1.5 -top-1.5 min-w-[18px] rounded-full bg-destructive px-1 text-center text-[10px] font-semibold leading-[18px] text-destructive-foreground">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </span>
      <span className="sr-only">CSKH</span>
    </Button>
  );
}
