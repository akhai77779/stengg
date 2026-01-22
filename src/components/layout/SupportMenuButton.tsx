import { useState } from "react";
import { MessageCircle, Phone, X } from "lucide-react";

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

  const handleOpenChat = () => {
    // Replace with your actual livechat service URL
    window.open("https://tawk.to/chat", "_blank", "width=400,height=600");
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          {open ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
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
        <DropdownMenuItem asChild>
          <a href="tel:+84123456789" className="flex items-center">
            <Phone className="mr-2 h-4 w-4" />
            Gọi hotline
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
