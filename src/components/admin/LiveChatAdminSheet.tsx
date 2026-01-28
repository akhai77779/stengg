import { useState, useEffect } from "react";
import { MessageCircle, ExternalLink, Maximize2, Minimize2, X } from "lucide-react";
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

interface LiveChatAdminSheetProps {
  trigger?: React.ReactNode;
}

export function LiveChatAdminSheet({ trigger }: LiveChatAdminSheetProps) {
  const [open, setOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [adminUrl, setAdminUrl] = useState("https://support.stengg.it.com/admin");
  const [iframeKey, setIframeKey] = useState(0);

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
          // Extract base domain and add /admin
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

  const handleRefresh = () => {
    setIframeKey(prev => prev + 1);
  };

  const handleOpenExternal = () => {
    window.open(adminUrl, "_blank", "noopener,noreferrer");
  };

  const defaultTrigger = (
    <Button variant="outline" size="sm" className="gap-2">
      <MessageCircle className="h-4 w-4" />
      <span className="hidden sm:inline">Live Chat Admin</span>
      <Badge variant="secondary" className="h-5 px-1.5 text-xs">
        Panel
      </Badge>
    </Button>
  );

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {trigger || defaultTrigger}
      </SheetTrigger>
      <SheetContent 
        side="right" 
        className={`p-0 flex flex-col transition-all duration-300 ${
          isFullscreen ? "w-full sm:max-w-full" : "w-full sm:max-w-[600px] lg:max-w-[800px]"
        }`}
      >
        <SheetHeader className="px-4 py-3 border-b flex-shrink-0">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-primary" />
              Live Chat Admin Panel
            </SheetTitle>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleRefresh}
                title="Refresh"
                className="h-8 w-8"
              >
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  width="16" 
                  height="16" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                >
                  <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                  <path d="M3 3v5h5" />
                  <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                  <path d="M16 16h5v5" />
                </svg>
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
