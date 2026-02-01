import { useState } from "react";
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
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";
import { LiveChatRoom } from "@/hooks/useLiveChatRooms";
import { LiveChatMessage } from "@/hooks/useLiveChatMessages";

interface CustomerInfoPanelProps {
  room: LiveChatRoom;
  messages: LiveChatMessage[];
  className?: string;
}

export function CustomerInfoPanel({ room, messages, className }: CustomerInfoPanelProps) {
  const [showAdditionalInfo, setShowAdditionalInfo] = useState(true);

  // Calculate stats
  const customerMessages = messages.filter(m => m.sender_type === "customer");
  const supportMessages = messages.filter(m => m.sender_type === "support" || m.sender_type === "bot");
  const chatDuration = messages.length > 0
    ? formatDistanceToNow(new Date(messages[0].created_at), { locale: vi })
    : "0 phút";
  
  // Get first message time
  const firstMessageTime = messages.length > 0 
    ? new Date(messages[0].created_at)
    : new Date(room.created_at);
  
  // Get current local time (simulated - in real app this would come from user's browser)
  const localTime = format(new Date(), "HH:mm", { locale: vi });

  // Check if this is first-time visitor (simplified - would need more data in real app)
  const isFirstTimeVisitor = true; // Placeholder
  const totalVisits = 1;
  const totalChats = 1;

  return (
    <ScrollArea className={cn("h-full border-l bg-muted/20", className)}>
      <div className="p-4 space-y-4">
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

          {/* Location (simulated) */}
          <div className="text-center space-y-0.5">
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
              <MapPin className="h-3 w-3" />
              Ho Chi Minh City, Vietnam
            </p>
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
              <Clock className="h-3 w-3" />
              {localTime} giờ địa phương
            </p>
          </div>
        </div>

        {/* Status Badge */}
        <div className="flex justify-center">
          <Badge 
            variant={room.status === "active" ? "default" : room.status === "waiting" ? "secondary" : "outline"}
            className="text-xs"
          >
            {room.status === "active" ? "Đang hoạt động" : room.status === "waiting" ? "Chờ phản hồi" : "Đã đóng"}
          </Badge>
        </div>

        {/* Map placeholder */}
        <Card className="overflow-hidden">
          <div className="h-32 bg-muted flex items-center justify-center relative">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900/30 dark:to-blue-800/30" />
            <div className="relative z-10 flex flex-col items-center gap-1">
              <MapPin className="h-6 w-6 text-red-500" />
              <span className="text-[10px] text-muted-foreground">Ho Chi Minh City</span>
            </div>
          </div>
          <a 
            href="https://maps.google.com/?q=Ho+Chi+Minh+City" 
            target="_blank" 
            rel="noopener noreferrer"
            className="block text-center py-1.5 text-xs text-primary hover:underline border-t"
          >
            Xem bản đồ lớn hơn
          </a>
        </Card>

        {/* Additional Info */}
        <Collapsible open={showAdditionalInfo} onOpenChange={setShowAdditionalInfo}>
          <CollapsibleTrigger className="flex items-center justify-between w-full py-2 text-sm font-medium">
            <span>Thông tin bổ sung</span>
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
                  <User className="h-3 w-3" />
                  Khách mới:
                </span>
                <span className="font-medium">
                  {totalVisits} lượt, {totalChats} chat
                </span>
              </div>
              
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Clock className="h-3 w-3" />
                  Thời lượng chat:
                </span>
                <span className="font-medium">{chatDuration}</span>
              </div>
              
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <MessageSquare className="h-3 w-3" />
                  Tin nhắn:
                </span>
                <span className="font-medium">
                  {customerMessages.length} / {supportMessages.length}
                </span>
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
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </ScrollArea>
  );
}
