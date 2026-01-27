import { useState } from 'react';
import { Bell, X, Clock, DollarSign, IdCard, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';

export interface NotificationItem {
  id: string;
  type: 'transaction' | 'verification';
  title: string;
  description: string;
  timestamp: Date;
  read: boolean;
}

interface NotificationHistoryProps {
  notifications: NotificationItem[];
  onClearAll: () => void;
  onMarkAsRead: (id: string) => void;
  unreadCount: number;
}

export function NotificationHistory({ 
  notifications, 
  onClearAll, 
  onMarkAsRead,
  unreadCount 
}: NotificationHistoryProps) {
  const [open, setOpen] = useState(false);

  const todayNotifications = notifications.filter(n => {
    const today = new Date();
    const notifDate = new Date(n.timestamp);
    return notifDate.toDateString() === today.toDateString();
  });

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs animate-pulse"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[540px]">
        <SheetHeader className="flex flex-row items-center justify-between">
          <SheetTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Lịch sử thông báo
          </SheetTitle>
          {todayNotifications.length > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onClearAll}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Xóa tất cả
            </Button>
          )}
        </SheetHeader>

        <div className="mt-4">
          <p className="text-sm text-muted-foreground mb-4">
            Thông báo trong ngày hôm nay ({todayNotifications.length})
          </p>

          {todayNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Bell className="h-12 w-12 mb-4 opacity-50" />
              <p>Chưa có thông báo nào hôm nay</p>
            </div>
          ) : (
            <ScrollArea className="h-[calc(100vh-200px)]">
              <div className="space-y-3 pr-4">
                {todayNotifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-4 rounded-lg border transition-colors cursor-pointer ${
                      notification.read 
                        ? 'bg-muted/30 border-border' 
                        : 'bg-primary/5 border-primary/20 hover:bg-primary/10'
                    }`}
                    onClick={() => onMarkAsRead(notification.id)}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-full ${
                        notification.type === 'transaction' 
                          ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' 
                          : 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                      }`}>
                        {notification.type === 'transaction' ? (
                          <DollarSign className="h-4 w-4" />
                        ) : (
                          <IdCard className="h-4 w-4" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm truncate">
                            {notification.title}
                          </p>
                          {!notification.read && (
                            <Badge variant="default" className="h-5 text-xs">
                              Mới
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {notification.description}
                        </p>
                        <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {formatDistanceToNow(notification.timestamp, { 
                            addSuffix: true, 
                            locale: vi 
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
