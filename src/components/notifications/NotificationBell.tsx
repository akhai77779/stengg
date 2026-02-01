import { useState, useMemo } from "react";
import { Bell, Check, CheckCheck, Volume2, VolumeX, X, DollarSign, IdCard, TrendingUp, UserPlus, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useUserNotifications } from "@/hooks/useUserNotifications";
import { useAdminNotifications } from "@/hooks/useAdminNotifications";
import { useLiveChatRooms } from "@/hooks/useLiveChatRooms";
import { useAuth } from "@/hooks/useAuth";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

interface NotificationBellProps {
  className?: string;
}

export function NotificationBell({ className }: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"user" | "admin" | "livechat">("user");
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  
  const {
    notifications: userNotifications,
    unreadCount: userUnreadCount,
    hasUnread: userHasUnread,
    isLoading,
    soundEnabled,
    toggleSound,
    markAsRead: markUserAsRead,
    markAllAsRead: markAllUserAsRead,
    deleteNotification,
  } = useUserNotifications();

  const {
    notificationHistory: adminNotifications,
    unreadNotificationCount: adminUnreadCount,
    markAsRead: markAdminAsRead,
    clearAllNotifications: clearAdminNotifications,
  } = useAdminNotifications();

  // Live Chat unread count for admin
  const { rooms: liveChatRooms, totalUnread: liveChatUnread } = useLiveChatRooms({
    autoRefresh: isAdmin,
  });

  // Total unread count (user notifications + admin notifications + live chat if admin)
  const totalUnreadCount = useMemo(() => {
    return userUnreadCount + (isAdmin ? adminUnreadCount + liveChatUnread : 0);
  }, [userUnreadCount, adminUnreadCount, liveChatUnread, isAdmin]);

  const hasUnread = totalUnreadCount > 0;

  // Get rooms with unread messages
  const roomsWithUnread = useMemo(() => {
    return liveChatRooms.filter(room => (room.unread_count || 0) > 0);
  }, [liveChatRooms]);

  const handleOpenLiveChat = (roomId?: string) => {
    setOpen(false);
    navigate("/admin/live-chat");
  };

  const getTypeStyles = (type: string) => {
    switch (type) {
      case "success":
        return "border-l-green-500 bg-green-500/5";
      case "error":
        return "border-l-red-500 bg-red-500/5";
      case "warning":
        return "border-l-yellow-500 bg-yellow-500/5";
      case "admin_message":
        return "border-l-blue-500 bg-blue-500/5";
      case "transaction":
        return "border-l-green-500 bg-green-500/5";
      case "verification":
        return "border-l-blue-500 bg-blue-500/5";
      case "option_trade":
        return "border-l-purple-500 bg-purple-500/5";
      case "new_user":
        return "border-l-orange-500 bg-orange-500/5";
      default:
        return "border-l-muted-foreground/50";
    }
  };

  const getAdminNotificationIcon = (type: string) => {
    switch (type) {
      case "transaction":
        return <DollarSign className="h-4 w-4 text-green-500" />;
      case "verification":
        return <IdCard className="h-4 w-4 text-blue-500" />;
      case "option_trade":
        return <TrendingUp className="h-4 w-4 text-purple-500" />;
      case "new_user":
        return <UserPlus className="h-4 w-4 text-orange-500" />;
      default:
        return <Bell className="h-4 w-4" />;
    }
  };

  const handleNotificationClick = async (notificationId: string, isRead: boolean) => {
    if (!isRead) {
      await markUserAsRead(notificationId);
    }
  };

  // Filter today's admin notifications
  const todayAdminNotifications = useMemo(() => {
    return adminNotifications.filter(n => {
      const today = new Date();
      const notifDate = new Date(n.timestamp);
      return notifDate.toDateString() === today.toDateString();
    });
  }, [adminNotifications]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("relative h-11 w-11 min-h-[44px] min-w-[44px] touch-manipulation active:scale-95 transition-transform", className)}
          aria-label="Thông báo"
        >
          <Bell className="h-5 w-5" />
          {hasUnread && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 min-w-[20px] px-1 text-xs animate-pulse"
            >
              {totalUnreadCount > 99 ? "99+" : totalUnreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[calc(100vw-1.5rem)] max-w-96 p-0 glass z-[9999]"
        align="end"
        side="bottom"
        sideOffset={8}
        collisionPadding={12}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            <span className="font-semibold text-sm">
              {isAdmin ? "Thông báo Tổng" : "Thông báo"}
            </span>
            {hasUnread && (
              <Badge variant="secondary" className="text-xs">
                {totalUnreadCount} mới
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 min-h-[36px] min-w-[36px] touch-manipulation active:scale-95"
              onClick={toggleSound}
              title={soundEnabled ? "Tắt âm thanh" : "Bật âm thanh"}
            >
              {soundEnabled ? (
                <Volume2 className="h-4 w-4" />
              ) : (
                <VolumeX className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
          </div>
        </div>

        {/* Content - Show tabs for admin, simple list for regular users */}
        {isAdmin ? (
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "user" | "admin" | "livechat")} className="w-full">
            <TabsList className="w-full grid grid-cols-3 h-10 rounded-none border-b">
              <TabsTrigger value="user" className="text-xs data-[state=active]:bg-accent relative px-2">
                Cá nhân
                {userUnreadCount > 0 && (
                  <Badge variant="destructive" className="ml-1 h-4 min-w-[16px] px-1 text-[10px]">
                    {userUnreadCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="admin" className="text-xs data-[state=active]:bg-accent relative px-2">
                Hệ thống
                {adminUnreadCount > 0 && (
                  <Badge variant="destructive" className="ml-1 h-4 min-w-[16px] px-1 text-[10px]">
                    {adminUnreadCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="livechat" className="text-xs data-[state=active]:bg-accent relative px-2">
                Chat
                {liveChatUnread > 0 && (
                  <Badge variant="destructive" className="ml-1 h-4 min-w-[16px] px-1 text-[10px] animate-pulse">
                    {liveChatUnread}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {/* User Notifications Tab */}
            <TabsContent value="user" className="m-0">
              <div className="flex items-center justify-end px-3 py-1.5 border-b bg-muted/30">
                {userHasUnread && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs touch-manipulation"
                    onClick={markAllUserAsRead}
                  >
                    <CheckCheck className="h-3.5 w-3.5 mr-1" />
                    Đánh dấu đã đọc
                  </Button>
                )}
              </div>
              <ScrollArea className="h-[min(300px,50vh)]">
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                  </div>
                ) : userNotifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                    <Bell className="h-8 w-8 mb-2 opacity-50" />
                    <p className="text-sm">Không có thông báo</p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {userNotifications.map((notification) => (
                      <div
                        key={notification.id}
                        className={cn(
                          "relative p-3 border-l-4 cursor-pointer transition-colors hover:bg-accent/50 active:bg-accent/70 touch-manipulation",
                          getTypeStyles(notification.type),
                          !notification.is_read && "bg-accent/30"
                        )}
                        onClick={() => handleNotificationClick(notification.id, notification.is_read)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className={cn(
                                "text-sm",
                                !notification.is_read && "font-semibold"
                              )}>
                                {notification.title}
                              </p>
                              {!notification.is_read && (
                                <span className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap break-words">
                              {notification.message}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
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
                                className="h-7 w-7 min-h-[28px] min-w-[28px] touch-manipulation active:scale-90"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  markUserAsRead(notification.id);
                                }}
                                title="Đánh dấu đã đọc"
                              >
                                <Check className="h-3 w-3" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 min-h-[28px] min-w-[28px] text-muted-foreground hover:text-destructive touch-manipulation active:scale-90"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteNotification(notification.id);
                              }}
                              title="Xóa thông báo"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            {/* Admin Notifications Tab */}
            <TabsContent value="admin" className="m-0">
              <div className="flex items-center justify-between px-3 py-1.5 border-b bg-muted/30">
                <span className="text-xs text-muted-foreground">
                  Hôm nay ({todayAdminNotifications.length})
                </span>
                {todayAdminNotifications.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-muted-foreground hover:text-destructive touch-manipulation"
                    onClick={clearAdminNotifications}
                  >
                    <X className="h-3 w-3 mr-1" />
                    Xóa tất cả
                  </Button>
                )}
              </div>
              <ScrollArea className="h-[min(300px,50vh)]">
                {todayAdminNotifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                    <Bell className="h-8 w-8 mb-2 opacity-50" />
                    <p className="text-sm">Chưa có thông báo hôm nay</p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {todayAdminNotifications.map((notification) => (
                      <div
                        key={notification.id}
                        className={cn(
                          "relative p-3 border-l-4 cursor-pointer transition-colors hover:bg-accent/50 active:bg-accent/70 touch-manipulation",
                          getTypeStyles(notification.type),
                          !notification.read && "bg-accent/30"
                        )}
                        onClick={() => markAdminAsRead(notification.id)}
                      >
                        <div className="flex items-start gap-3">
                          <div className="p-1.5 rounded-full bg-muted shrink-0">
                            {getAdminNotificationIcon(notification.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className={cn(
                                "text-sm",
                                !notification.read && "font-semibold"
                              )}>
                                {notification.title}
                              </p>
                              {!notification.read && (
                                <Badge variant="default" className="h-4 text-[10px] px-1">
                                  Mới
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap break-words">
                              {notification.description}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {formatDistanceToNow(notification.timestamp, {
                                addSuffix: true,
                                locale: vi,
                              })}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            {/* Live Chat Tab */}
            <TabsContent value="livechat" className="m-0">
              <div className="flex items-center justify-between px-3 py-1.5 border-b bg-muted/30">
                <span className="text-xs text-muted-foreground">
                  {roomsWithUnread.length} phòng có tin nhắn mới
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs touch-manipulation"
                  onClick={() => handleOpenLiveChat()}
                >
                  <MessageSquare className="h-3 w-3 mr-1" />
                  Mở Live Chat
                </Button>
              </div>
              <ScrollArea className="h-[min(300px,50vh)]">
                {roomsWithUnread.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                    <MessageSquare className="h-8 w-8 mb-2 opacity-50" />
                    <p className="text-sm">Không có tin nhắn chưa đọc</p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {roomsWithUnread.map((room) => (
                      <div
                        key={room.id}
                        className="relative p-3 border-l-4 border-l-blue-500 bg-blue-500/5 cursor-pointer transition-colors hover:bg-accent/50 active:bg-accent/70 touch-manipulation"
                        onClick={() => handleOpenLiveChat(room.id)}
                      >
                        <div className="flex items-start gap-3">
                          <div className="p-1.5 rounded-full bg-blue-500/20 shrink-0">
                            <MessageSquare className="h-4 w-4 text-blue-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold truncate">
                                {room.customer_name}
                              </p>
                              <Badge variant="destructive" className="h-4 text-[10px] px-1 animate-pulse">
                                {room.unread_count} tin nhắn
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1 truncate">
                              {room.last_message || "Tin nhắn mới"}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {formatDistanceToNow(new Date(room.last_updated_at), {
                                addSuffix: true,
                                locale: vi,
                              })}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        ) : (
          // Regular user - simple notification list without tabs
          <>
            <div className="flex items-center justify-end px-3 py-1.5 border-b bg-muted/30">
              {userHasUnread && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs touch-manipulation"
                  onClick={markAllUserAsRead}
                >
                  <CheckCheck className="h-3.5 w-3.5 mr-1" />
                  Đánh dấu đã đọc
                </Button>
              )}
            </div>
            <ScrollArea className="h-[min(350px,60vh)]">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                </div>
              ) : userNotifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <Bell className="h-8 w-8 mb-2 opacity-50" />
                  <p className="text-sm">Không có thông báo</p>
                </div>
              ) : (
                <div className="divide-y">
                  {userNotifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={cn(
                        "relative p-3 sm:p-4 border-l-4 cursor-pointer transition-colors hover:bg-accent/50 active:bg-accent/70 touch-manipulation",
                        getTypeStyles(notification.type),
                        !notification.is_read && "bg-accent/30"
                      )}
                      onClick={() => handleNotificationClick(notification.id, notification.is_read)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className={cn(
                              "text-sm",
                              !notification.is_read && "font-semibold"
                            )}>
                              {notification.title}
                            </p>
                            {!notification.is_read && (
                              <span className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap break-words">
                            {notification.message}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
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
                              className="h-8 w-8 min-h-[32px] min-w-[32px] touch-manipulation active:scale-90"
                              onClick={(e) => {
                                e.stopPropagation();
                                markUserAsRead(notification.id);
                              }}
                              title="Đánh dấu đã đọc"
                            >
                              <Check className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 min-h-[32px] min-w-[32px] text-muted-foreground hover:text-destructive touch-manipulation active:scale-90"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteNotification(notification.id);
                            }}
                            title="Xóa thông báo"
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </>
        )}

        {/* Footer */}
        <Separator />
        <div className="p-2 text-center">
          <p className="text-xs text-muted-foreground">
            {isAdmin ? "Thông báo tổng hợp: Cá nhân + Hệ thống + Live Chat" : "Thông báo được lưu trong 30 ngày"}
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
