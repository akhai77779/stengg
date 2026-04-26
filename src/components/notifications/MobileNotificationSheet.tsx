import { Bell, Check, CheckCheck, Volume2, VolumeX, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useUserNotifications } from "@/hooks/useUserNotifications";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";
import { cleanTradeResultText, getNotificationTitle, getUserNotificationStyles, TradeResultIcon } from "./notificationDisplay";

interface MobileNotificationSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MobileNotificationSheet({ open, onOpenChange }: MobileNotificationSheetProps) {
  const {
    notifications,
    unreadCount,
    hasUnread,
    isLoading,
    soundEnabled,
    toggleSound,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useUserNotifications();

  const handleNotificationClick = async (notificationId: string, isRead: boolean) => {
    if (!isRead) {
      await markAsRead(notificationId);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-2xl px-0">
        <SheetHeader className="px-4 pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              <SheetTitle>Thông báo</SheetTitle>
              {hasUnread && (
                <Badge variant="secondary" className="text-xs">
                  {unreadCount} mới
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={toggleSound}
                title={soundEnabled ? "Tắt âm thanh" : "Bật âm thanh"}
              >
                {soundEnabled ? (
                  <Volume2 className="h-4 w-4" />
                ) : (
                  <VolumeX className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
              {hasUnread && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={markAllAsRead}
                  title="Đánh dấu tất cả đã đọc"
                >
                  <CheckCheck className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </SheetHeader>

        <Separator />

        {/* Notifications List */}
        <ScrollArea className="h-[calc(85vh-100px)]">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Bell className="h-12 w-12 mb-3 opacity-50" />
              <p className="text-sm">Không có thông báo</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={cn(
                    "relative p-4 border-l-4 cursor-pointer transition-colors active:bg-accent/70",
                    getNotificationStyles(notification),
                    !notification.is_read && "bg-accent/30"
                  )}
                  onClick={() => handleNotificationClick(notification.id, notification.is_read)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={cn(
                          "text-sm",
                          !notification.is_read && "font-semibold"
                        )}>
                          {getTradeResultIcon(notification)}
                          {getNotificationTitle(notification)}
                        </p>
                        {!notification.is_read && (
                          <span className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {cleanTradeResultText(notification.message)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1.5">
                        {formatDistanceToNow(new Date(notification.created_at), {
                          addSuffix: true,
                          locale: vi,
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {!notification.is_read && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            markAsRead(notification.id);
                          }}
                          title="Đánh dấu đã đọc"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteNotification(notification.id);
                        }}
                        title="Xóa thông báo"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        {notifications.length > 0 && (
          <div className="absolute bottom-0 left-0 right-0 p-3 bg-background border-t text-center">
            <p className="text-xs text-muted-foreground">
              Thông báo được lưu trong 30 ngày
            </p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
