import { useEffect, useState } from "react";
import { MessageCircle, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Mobile-only CSKH quick actions.
 * (Icon in header; actions open chat and hotline.)
 */
export function SupportMenuButton() {
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState<number>(() => {
    const raw = localStorage.getItem("support_unread_count");
    const parsed = raw ? Number(raw) : 0;
    return Number.isFinite(parsed) ? parsed : 0;
  });

  useEffect(() => {
    localStorage.setItem("support_unread_count", String(unreadCount));
  }, [unreadCount]);

  const handleOpenChat = () => {
    // Replace with your actual livechat service URL
    setUnreadCount(0);
    window.open("https://tawk.to/chat", "_blank", "width=400,height=600");
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <span className="relative">
            {open ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
            {unreadCount > 0 && !open && (
              <span className="absolute -right-1.5 -top-1.5 min-w-[18px] rounded-full bg-destructive px-1 text-center text-[10px] font-semibold leading-[18px] text-destructive-foreground">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </span>
          <span className="sr-only">CSKH</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56 glass" align="end">
        <div className="px-2 py-2">
          <div className="text-sm font-medium text-foreground">CSKH</div>
          <div className="text-xs text-muted-foreground">Hỗ trợ 24/7</div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleOpenChat} className="cursor-pointer">
          <MessageCircle className="mr-2 h-4 w-4" />
          Mở live chat
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
