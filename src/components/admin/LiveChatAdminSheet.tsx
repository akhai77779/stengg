import { useState, useEffect } from "react";
import { MessageCircle, Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { useLiveChatUnread } from "@/hooks/useLiveChatUnread";
import { cn } from "@/lib/utils";
import { LiveChatAdminPanel } from "./LiveChatAdminPanel";

interface LiveChatAdminSheetProps {
  trigger?: React.ReactNode;
  showBadge?: boolean;
}

export function LiveChatAdminSheet({ trigger, showBadge = true }: LiveChatAdminSheetProps) {
  const [open, setOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  const { 
    unreadCount, 
    clearUnread, 
    hasUnread,
  } = useLiveChatUnread();

  // Clear unread when sheet opens
  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => {
        clearUnread();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [open, clearUnread]);

  // Default trigger with unread badge
  const defaultTrigger = (
    <Button variant="outline" size="sm" className="gap-2 relative">
      <span className="relative">
        <MessageCircle className="h-4 w-4" />
        {showBadge && hasUnread && (
          <span className="absolute -right-1 -top-1 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-destructive" />
          </span>
        )}
      </span>
      <span className="hidden sm:inline">Live Chat</span>
      {showBadge && hasUnread && (
        <Badge 
          variant="destructive" 
          className="h-5 min-w-5 px-1.5 text-xs animate-pulse"
        >
          {unreadCount > 99 ? "99+" : unreadCount}
        </Badge>
      )}
    </Button>
  );

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {trigger || defaultTrigger}
      </SheetTrigger>
      <SheetContent 
        side="right" 
        className={cn(
          "p-0 flex flex-col transition-all duration-300",
          isFullscreen ? "w-full sm:max-w-full" : "w-full sm:max-w-[700px] lg:max-w-[900px]"
        )}
      >
        <SheetHeader className="px-4 py-3 border-b flex-shrink-0">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-primary" />
              Live Chat
              {hasUnread && (
                <Badge variant="destructive" className="h-5 px-1.5 text-xs">
                  {unreadCount} mới
                </Badge>
              )}
            </SheetTitle>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsFullscreen(!isFullscreen)}
                title={isFullscreen ? "Thu nhỏ" : "Phóng to"}
                className="h-8 w-8"
              >
                {isFullscreen ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </SheetHeader>
        
        <div className="flex-1 overflow-hidden">
          <LiveChatAdminPanel isEmbedded onClearUnread={clearUnread} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
