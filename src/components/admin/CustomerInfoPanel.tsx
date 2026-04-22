import { useState, useEffect } from "react";
import {
  User,
  MapPin,
  Clock,
  MessageSquare,
  Calendar,
  ChevronDown,
  ChevronUp,
  Mail,
  Hash,
  Bot,
  Timer,
  Wifi,
  WifiOff,
  Eye,
  Globe,
  RefreshCw,
  Building2,
  X,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";
import { LiveChatRoom } from "@/hooks/useLiveChatRooms";
import { LiveChatMessage } from "@/hooks/useLiveChatMessages";
import { BOT_CONFIG, isWithinWorkingHours } from "@/hooks/useLiveChatBot";
import { useIPGeolocation, getCountryFlag } from "@/hooks/useIPGeolocation";
import { supabase } from "@/integrations/supabase/client";

interface CustomerInfoPanelProps {
  room: LiveChatRoom;
  messages: LiveChatMessage[];
  className?: string;
  typingPreview?: string | null;
  botEnabled?: boolean;
  onClose?: () => void;
}

export function CustomerInfoPanel({ 
  room, 
  messages, 
  className,
  typingPreview,
  botEnabled = true,
  onClose,
}: CustomerInfoPanelProps) {
  const [showAdditionalInfo, setShowAdditionalInfo] = useState(true);
  const [showBotInfo, setShowBotInfo] = useState(true);
  const [showLocationInfo, setShowLocationInfo] = useState(true);
  const [customerIp, setCustomerIp] = useState<string | null>(null);
  const [ipLookupDone, setIpLookupDone] = useState(false);
  const isWorking = isWithinWorkingHours();

  // Look up customer's last_login_ip from profiles (skip for guests)
  useEffect(() => {
    let cancelled = false;
    setIpLookupDone(false);
    setCustomerIp(null);

    const isGuest = room.customer_id?.startsWith("guest_");
    if (isGuest) {
      setIpLookupDone(true);
      return;
    }

    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("last_login_ip")
        .eq("id", room.customer_id)
        .maybeSingle();
      if (cancelled) return;
      setCustomerIp(data?.last_login_ip ?? null);
      setIpLookupDone(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [room.customer_id]);

  // Fetch geolocation for customer's IP (only after lookup completes and we have an IP)
  const { location, isLoading: locationLoading, refetch: refetchLocation } = useIPGeolocation({
    // Always run after lookup completes. If we have customer IP, look that up;
    // otherwise fall back to the browser's current IP (no `ip` param sent).
    enabled: ipLookupDone,
    cacheKey: customerIp ? `customer_${room.customer_id}` : "browser_fallback",
    ip: customerIp,
  });

  // Whether we're showing the browser's IP as a fallback (no stored customer IP)
  const usingBrowserFallback = ipLookupDone && !customerIp;

  // Calculate stats
  const customerMessages = messages.filter(m => m.sender_type === "customer");
  const supportMessages = messages.filter(m => m.sender_type === "support");
  const botMessages = messages.filter(m => m.sender_type === "bot");
  const chatDuration = messages.length > 0
    ? formatDistanceToNow(new Date(messages[0].created_at), { locale: vi })
    : "0 phút";
  
  // Get first message time
  const firstMessageTime = messages.length > 0 
    ? new Date(messages[0].created_at)
    : new Date(room.created_at);
  
  // Get last activity time
  const lastActivityTime = messages.length > 0
    ? new Date(messages[messages.length - 1].created_at)
    : new Date(room.last_updated_at);
  
  // Calculate time since last customer message
  const lastCustomerMsg = [...customerMessages].pop();
  const timeSinceLastCustomer = lastCustomerMsg
    ? formatDistanceToNow(new Date(lastCustomerMsg.created_at), { addSuffix: true, locale: vi })
    : null;

  // Session timeout countdown
  const sessionTimeoutMinutes = BOT_CONFIG.SESSION_TIMEOUT / 60000;
  const adminBusyMinutes = BOT_CONFIG.ADMIN_BUSY_DELAY / 60000;

  return (
    <div className={cn("h-full border-l bg-muted/20 overflow-y-auto overscroll-contain", className)}>
      <div className="p-4 space-y-4">
        {/* Close button for desktop */}
        {onClose && (
          <div className="flex justify-end -mt-2 -mr-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
        
        {/* Customer Avatar & Name */}
        <div className="flex flex-col items-center text-center space-y-3">
          <Avatar className="h-16 w-16">
            <AvatarFallback className="text-xl bg-primary text-primary-foreground">
              {room.customer_name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          
          <div className="space-y-1">
            <h3 className="font-semibold text-base">{room.customer_name}</h3>
            {room.customer_email && (
              <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                <Mail className="h-3 w-3" />
                {room.customer_email}
              </p>
            )}
          </div>

          {/* Location from IP */}
          <div className="text-center space-y-0.5">
            {!ipLookupDone || locationLoading ? (
              <>
                <Skeleton className="h-4 w-32 mx-auto" />
                <Skeleton className="h-4 w-24 mx-auto" />
              </>
            ) : location ? (
              <>
                <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {getCountryFlag(location.country_code)} {location.city}, {location.country}
                </p>
                <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                  <Clock className="h-3 w-3" />
                  {location.localTime} giờ địa phương
                </p>
                {usingBrowserFallback && (
                  <p className="text-[10px] text-muted-foreground/70 italic">
                    (IP trình duyệt — chưa có lịch sử đăng nhập)
                  </p>
                )}
              </>
            ) : (
              <p className="text-xs text-muted-foreground">Không xác định vị trí</p>
            )}
          </div>
        </div>

        {/* Status Badge */}
        <div className="flex justify-center gap-2">
          <Badge 
            variant={room.status === "active" ? "default" : room.status === "waiting" ? "secondary" : "outline"}
            className="text-xs"
          >
            {room.status === "active" ? "Đang hoạt động" : room.status === "waiting" ? "Chờ phản hồi" : "Đã đóng"}
          </Badge>
          <Badge 
            variant={isWorking ? "default" : "secondary"}
            className={cn("text-xs", isWorking ? "bg-green-600" : "")}
          >
            {isWorking ? (
              <><Wifi className="h-3 w-3 mr-1" />Online</>
            ) : (
              <><WifiOff className="h-3 w-3 mr-1" />Offline</>
            )}
          </Badge>
        </div>

        {/* Typing Preview - Real-time customer input preview */}
        {typingPreview && (
          <Card className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 animate-fade-in">
            <div className="flex items-start gap-2">
              <div className="relative">
                <Eye className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                <span className="absolute -top-0.5 -right-0.5 h-2 w-2 bg-green-500 rounded-full animate-pulse" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-xs font-medium text-yellow-800 dark:text-yellow-200">
                    Đang xem trước:
                  </p>
                  <span className="flex gap-0.5">
                    <span className="h-1.5 w-1.5 bg-yellow-500 rounded-full animate-pulse" style={{ animationDelay: '0ms' }} />
                    <span className="h-1.5 w-1.5 bg-yellow-500 rounded-full animate-pulse" style={{ animationDelay: '200ms' }} />
                    <span className="h-1.5 w-1.5 bg-yellow-500 rounded-full animate-pulse" style={{ animationDelay: '400ms' }} />
                  </span>
                </div>
                <p className="text-sm text-yellow-700 dark:text-yellow-300 break-words italic bg-yellow-100/50 dark:bg-yellow-900/30 px-2 py-1 rounded">
                  "{typingPreview}"
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Location Details */}
        <Collapsible open={showLocationInfo} onOpenChange={setShowLocationInfo}>
          <CollapsibleTrigger className="flex items-center justify-between w-full py-2 text-sm font-medium">
            <span className="flex items-center gap-2">
              <Globe className="h-4 w-4" />
              Vị trí & IP
            </span>
            {showLocationInfo ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-2">
            <Card className="p-3 space-y-2">
              {locationLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ) : location ? (
                <>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">IP Address:</span>
                    <span className="font-mono text-[10px]">
                      {location.ip}
                      {location.is_default && (
                        <Badge variant="outline" className="ml-1 text-[8px] px-1 py-0">mặc định</Badge>
                      )}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Quốc gia:</span>
                    <span className="font-medium">
                      {getCountryFlag(location.country_code)} {location.country}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Thành phố:</span>
                    <span className="font-medium">{location.city}, {location.region}</span>
                  </div>
                  
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Timezone:</span>
                    <span className="font-medium">{location.timezone}</span>
                  </div>
                  
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Building2 className="h-3 w-3" />
                      ISP:
                    </span>
                    <span className="font-medium text-right max-w-[120px] truncate" title={location.isp}>
                      {location.isp}
                    </span>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full mt-1 text-xs h-7"
                    onClick={() => refetchLocation()}
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Làm mới vị trí
                  </Button>
                </>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-2">
                  Không có dữ liệu vị trí
                </p>
              )}
            </Card>

            {/* Map with real coordinates */}
            {location && (
              <Card className="overflow-hidden">
                <div className="h-32 bg-muted flex items-center justify-center relative">
                  <iframe
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${location.lon - 0.05},${location.lat - 0.03},${location.lon + 0.05},${location.lat + 0.03}&layer=mapnik&marker=${location.lat},${location.lon}`}
                    className="absolute inset-0 w-full h-full border-0"
                    loading="lazy"
                  />
                </div>
                <a 
                  href={`https://www.google.com/maps/search/?api=1&query=${location.lat},${location.lon}`}
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="block text-center py-1.5 text-xs text-primary hover:underline border-t"
                >
                  Xem trên Google Maps
                </a>
              </Card>
            )}
          </CollapsibleContent>
        </Collapsible>

        {/* Bot/Automation Info */}
        <Collapsible open={showBotInfo} onOpenChange={setShowBotInfo}>
          <CollapsibleTrigger className="flex items-center justify-between w-full py-2 text-sm font-medium">
            <span className="flex items-center gap-2">
              <Bot className="h-4 w-4" />
              Bot & Tự động
            </span>
            {showBotInfo ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-2">
            <Card className="p-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Bot tự động:</span>
                <Badge variant={botEnabled ? "default" : "secondary"} className="text-[10px]">
                  {botEnabled ? "BẬT" : "TẮT"}
                </Badge>
              </div>
              
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Giờ làm việc:</span>
                <span className="font-medium">
                  {BOT_CONFIG.WORKING_HOURS_START}:00 - {BOT_CONFIG.WORKING_HOURS_END}:00
                </span>
              </div>
              
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Admin không phản hồi:</span>
                <span className="font-medium">{adminBusyMinutes} phút → Bot</span>
              </div>
              
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Session timeout:</span>
                <span className="font-medium">{sessionTimeoutMinutes} phút</span>
              </div>

              {timeSinceLastCustomer && (
                <div className="flex items-center justify-between text-xs pt-1 border-t">
                  <span className="text-muted-foreground">Tin nhắn cuối:</span>
                  <span className="font-medium text-primary">{timeSinceLastCustomer}</span>
                </div>
              )}
            </Card>
          </CollapsibleContent>
        </Collapsible>

        {/* Additional Info */}
        <Collapsible open={showAdditionalInfo} onOpenChange={setShowAdditionalInfo}>
          <CollapsibleTrigger className="flex items-center justify-between w-full py-2 text-sm font-medium">
            <span>Thống kê</span>
            {showAdditionalInfo ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3">
            {/* Stats Grid */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Clock className="h-3 w-3" />
                  Thời lượng:
                </span>
                <span className="font-medium">{chatDuration}</span>
              </div>
              
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <MessageSquare className="h-3 w-3" />
                  Khách / Support:
                </span>
                <span className="font-medium">
                  {customerMessages.length} / {supportMessages.length}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Bot className="h-3 w-3" />
                  Bot messages:
                </span>
                <span className="font-medium">{botMessages.length}</span>
              </div>
              
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="h-3 w-3" />
                  Bắt đầu:
                </span>
                <span className="font-medium">
                  {format(firstMessageTime, "HH:mm dd/MM", { locale: vi })}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Timer className="h-3 w-3" />
                  Hoạt động cuối:
                </span>
                <span className="font-medium">
                  {format(lastActivityTime, "HH:mm dd/MM", { locale: vi })}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Hash className="h-3 w-3" />
                  Room ID:
                </span>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {room.id.slice(0, 8)}...
                </span>
              </div>
            </div>

            {/* Groups/Tags */}
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">Nhóm:</p>
              <div className="flex flex-wrap gap-1">
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  General
                </Badge>
                {room.status === "active" && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-green-500/10 text-green-600 border-green-500/30">
                    Active
                  </Badge>
                )}
                {!isWorking && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-orange-500/10 text-orange-600 border-orange-500/30">
                    Ngoài giờ
                  </Badge>
                )}
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
}
