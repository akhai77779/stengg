import { useState, useEffect, useRef } from "react";
import { MessageCircle, ExternalLink, Maximize2, Minimize2, X, RefreshCw, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useLiveChatUnread } from "@/hooks/useLiveChatUnread";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface LiveChatAdminSheetProps {
  trigger?: React.ReactNode;
  showBadge?: boolean;
}

export function LiveChatAdminSheet({ trigger, showBadge = true }: LiveChatAdminSheetProps) {
  const [open, setOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [adminUrl, setAdminUrl] = useState("https://support.stengg.it.com/admin");
  const [iframeKey, setIframeKey] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  
  const { unreadCount, clearUnread, hasUnread, soundEnabled, toggleSound, playSound } = useLiveChatUnread();

  // Load admin URL from settings
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const { data } = await supabase
          .from("app_settings")
          .select("value")
          .eq("key", "live_chat_url")
          .single();
        
        if (data?.value) {
          const baseUrl = (data.value as { url?: string })?.url || "";
          if (baseUrl) {
            const url = new URL(baseUrl);
            setAdminUrl(`${url.origin}/admin`);
          }
        }
      } catch {
        // Use default URL
      }
    };
    loadSettings();
  }, []);

  // Clear unread when sheet opens
  useEffect(() => {
    if (open) {
      // Delay to allow iframe to load and sync
      const timer = setTimeout(() => {
        clearUnread();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [open, clearUnread]);

  const handleRefresh = () => {
    setIframeKey(prev => prev + 1);
  };

  const handleOpenExternal = () => {
    window.open(adminUrl, "_blank", "noopener,noreferrer");
  };

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
          isFullscreen ? "w-full sm:max-w-full" : "w-full sm:max-w-[600px] lg:max-w-[800px]"
        )}
      >
        <SheetHeader className="px-4 py-3 border-b flex-shrink-0">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-primary" />
              Live Chat Admin Panel
              {hasUnread && (
                <Badge variant="destructive" className="h-5 px-1.5 text-xs">
                  {unreadCount} tin nhắn mới
                </Badge>
              )}
            </SheetTitle>
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      toggleSound();
                      if (!soundEnabled) playSound(); // Play demo sound when enabling
                    }}
                    title={soundEnabled ? "Tắt âm thanh" : "Bật âm thanh"}
                    className="h-8 w-8"
                  >
                    {soundEnabled ? (
                      <Volume2 className="h-4 w-4 text-primary" />
                    ) : (
                      <VolumeX className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {soundEnabled ? "Tắt âm thanh thông báo" : "Bật âm thanh thông báo"}
                </TooltipContent>
              </Tooltip>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleRefresh}
                title="Refresh"
                className="h-8 w-8"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
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
              <Button
                variant="ghost"
                size="icon"
                onClick={handleOpenExternal}
                title="Mở trong tab mới"
                className="h-8 w-8"
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setOpen(false)}
                className="h-8 w-8 -mr-2"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </SheetHeader>
        
        <div className="flex-1 relative bg-muted/30">
          <iframe
            ref={iframeRef}
            key={iframeKey}
            src={adminUrl}
            className="absolute inset-0 w-full h-full border-0"
            title="Live Chat Admin Panel"
            allow="clipboard-write; clipboard-read"
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals"
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
