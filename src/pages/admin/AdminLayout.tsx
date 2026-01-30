import { useEffect, useMemo, type ComponentType } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  BarChart3,
  Image as ImageIcon,
  Newspaper,
  Package,
  Heart,
  CreditCard,
  ClipboardList,
  Users,
  Menu,
  Settings,
  Clock,
  UserCheck,
  MessageCircle,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAdminNotifications } from "@/hooks/useAdminNotifications";
import { NotificationHistory } from "@/components/admin/NotificationHistory";
import { LiveChatAdminSheet } from "@/components/admin/LiveChatAdminSheet";
import { cn } from "@/lib/utils";

type AdminNavItem = {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  badgeKey?: 'verification' | 'transaction';
};

interface AdminSidebarProps {
  onNavigate?: () => void;
  pendingVerificationCount: number;
  pendingTransactionCount: number;
}

function AdminSidebar({ onNavigate, pendingVerificationCount, pendingTransactionCount }: AdminSidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();

  const items: AdminNavItem[] = useMemo(
    () => [
      { to: "/admin/overview", label: t('admin.overview'), icon: BarChart3 },
      { to: "/admin/live-chat", label: "Live Chat", icon: MessageCircle },
      { to: "/admin/banners", label: t('admin.banners'), icon: ImageIcon },
      { to: "/admin/news", label: t('admin.news'), icon: Newspaper },
      { to: "/admin/products", label: t('admin.products'), icon: Package },
      { to: "/admin/option-trades", label: "Option Trades", icon: Clock },
      { to: "/admin/charity", label: t('admin.charity'), icon: Heart },
      { to: "/admin/transactions", label: t('admin.transactions'), icon: CreditCard, badgeKey: 'transaction' },
      { to: "/admin/identity-verifications", label: t('admin.identityVerifications'), icon: UserCheck, badgeKey: 'verification' },
      { to: "/admin/audit-logs", label: t('admin.auditLogs'), icon: ClipboardList },
      { to: "/admin/users", label: t('admin.users'), icon: Users },
      { to: "/admin/settings", label: t('admin.settings'), icon: Settings },
    ],
    [t]
  );

  const getBadgeCount = (badgeKey?: 'verification' | 'transaction') => {
    if (badgeKey === 'verification') return pendingVerificationCount;
    if (badgeKey === 'transaction') return pendingTransactionCount;
    return 0;
  };

  return (
    <aside className="h-full">
      <div className="p-4">
        <div className="text-sm font-semibold tracking-wide text-muted-foreground">
          {t('admin.title')}
        </div>
      </div>
      <div className="px-2 pb-4">
        {items.map((item) => {
          const active = location.pathname === item.to;
          const Icon = item.icon;
          const badgeCount = getBadgeCount(item.badgeKey);
          return (
            <Button
              key={item.to}
              variant={active ? "secondary" : "ghost"}
              className={cn(
                "w-full justify-start gap-2",
                active && "font-medium"
              )}
              onClick={() => {
                navigate(item.to);
                onNavigate?.();
              }}
            >
              <Icon className="h-4 w-4" />
              <span className="flex-1 text-left">{item.label}</span>
              {badgeCount > 0 && (
                <Badge variant="destructive" className="h-5 min-w-5 px-1.5 text-xs animate-pulse">
                  {badgeCount}
                </Badge>
              )}
            </Button>
          );
        })}
      </div>
    </aside>
  );
}

export default function AdminLayout() {
  const { user, isAdmin, isLoading: authLoading, isAdminLoading } = useAuth();
  const { 
    pendingVerificationCount, 
    pendingTransactionCount,
    notificationHistory,
    unreadNotificationCount,
    markAsRead,
    clearAllNotifications
  } = useAdminNotifications();
  const navigate = useNavigate();

  useEffect(() => {
    if (authLoading || isAdminLoading) return;
    if (!user) navigate("/login");
    else if (!isAdmin) navigate("/");
  }, [authLoading, isAdminLoading, user, isAdmin, navigate]);

  if (authLoading || isAdminLoading) return null;
  if (!user || !isAdmin) return null;

  return (
    <Layout>
      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-6">
          <div className="hidden md:block">
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <AdminSidebar 
                pendingVerificationCount={pendingVerificationCount}
                pendingTransactionCount={pendingTransactionCount}
              />
            </div>
          </div>

          <div className="space-y-4">
            {/* Mobile menu and notification history */}
            <div className="flex items-center justify-between md:justify-end gap-2">
              <div className="md:hidden">
                <Sheet>
                  <SheetTrigger asChild>
                    <Button variant="outline" className="gap-2">
                      <Menu className="h-4 w-4" />
                      Menu admin
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="w-[320px]">
                    <SheetHeader>
                      <SheetTitle>Menu quản trị</SheetTitle>
                    </SheetHeader>
                    <div className="mt-4">
                      <AdminSidebar 
                        onNavigate={() => undefined}
                        pendingVerificationCount={pendingVerificationCount}
                        pendingTransactionCount={pendingTransactionCount}
                      />
                    </div>
                  </SheetContent>
                </Sheet>
              </div>

              {/* Live Chat Admin Button */}
              <LiveChatAdminSheet 
                trigger={
                  <Button variant="outline" size="sm" className="gap-2">
                    <MessageCircle className="h-4 w-4" />
                    <span className="hidden sm:inline">Live Chat</span>
                  </Button>
                }
              />

              {/* Notification History Button */}
              <NotificationHistory
                notifications={notificationHistory}
                onClearAll={clearAllNotifications}
                onMarkAsRead={markAsRead}
                unreadCount={unreadNotificationCount}
              />
            </div>

            <div className="rounded-xl border border-border bg-card p-4 md:p-6">
              <Outlet />
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
