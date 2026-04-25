import { useMemo, type ComponentType } from "react";
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
  LayoutDashboard,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAdminNotifications } from "@/hooks/useAdminNotifications";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { LiveChatAdminSheet } from "@/components/admin/LiveChatAdminSheet";
import { cn } from "@/lib/utils";

type AdminNavItem = {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  badgeKey?: 'verification' | 'transaction' | 'option_trade' | 'new_user';
};

interface AdminSidebarProps {
  onNavigate?: () => void;
  pendingVerificationCount: number;
  pendingTransactionCount: number;
  pendingOptionTradeCount: number;
  newUserCount: number;
}

function AdminSidebar({ onNavigate, pendingVerificationCount, pendingTransactionCount, pendingOptionTradeCount, newUserCount }: AdminSidebarProps) {
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
      { to: "/admin/products-monitor", label: "Market Monitor", icon: LayoutDashboard },
      { to: "/admin/option-trades", label: "Option Trades", icon: Clock, badgeKey: 'option_trade' },
      { to: "/admin/charity", label: t('admin.charity'), icon: Heart },
      { to: "/admin/charity-donations", label: "Quyên góp", icon: Heart },
      { to: "/admin/transactions", label: t('admin.transactions'), icon: CreditCard, badgeKey: 'transaction' },
      { to: "/admin/identity-verifications", label: t('admin.identityVerifications'), icon: UserCheck, badgeKey: 'verification' },
      { to: "/admin/audit-logs", label: t('admin.auditLogs'), icon: ClipboardList },
      { to: "/admin/users", label: t('admin.users'), icon: Users, badgeKey: 'new_user' },
      { to: "/admin/settings", label: t('admin.settings'), icon: Settings },
    ],
    [t]
  );

  const getBadgeCount = (badgeKey?: 'verification' | 'transaction' | 'option_trade' | 'new_user') => {
    if (badgeKey === 'verification') return pendingVerificationCount;
    if (badgeKey === 'transaction') return pendingTransactionCount;
    if (badgeKey === 'option_trade') return pendingOptionTradeCount;
    if (badgeKey === 'new_user') return newUserCount;
    return 0;
  };

  return (
    <aside className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 px-3 py-3 sm:px-4">
        <div className="truncate text-sm font-semibold tracking-wide text-muted-foreground">
          {t('admin.title')}
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain px-2 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        {items.map((item) => {
          const active = location.pathname === item.to;
          const Icon = item.icon;
          const badgeCount = getBadgeCount(item.badgeKey);
          return (
            <Button
              key={item.to}
              variant={active ? "secondary" : "ghost"}
              className={cn(
                "h-11 w-full min-w-0 justify-start gap-2 px-3 text-sm",
                active && "font-medium"
              )}
              onClick={() => {
                navigate(item.to);
                onNavigate?.();
              }}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="min-w-0 flex-1 truncate text-left leading-none">{item.label}</span>
              {badgeCount > 0 && (
                <Badge variant="destructive" className="h-5 min-w-5 shrink-0 px-1.5 text-xs animate-pulse">
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
  const { 
    pendingVerificationCount, 
    pendingTransactionCount,
    pendingOptionTradeCount,
    newUserCount,
  } = useAdminNotifications();
  const navigate = useNavigate();
   const location = useLocation();
   
   // Hide footer on live-chat page for full-height layout
   const isLiveChatPage = location.pathname === '/admin/live-chat';

  return (
     <Layout hideFooter={isLiveChatPage}>
      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-6">
          <div className="hidden md:block">
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <AdminSidebar 
                pendingVerificationCount={pendingVerificationCount}
                pendingTransactionCount={pendingTransactionCount}
                pendingOptionTradeCount={pendingOptionTradeCount}
                newUserCount={newUserCount}
              />
            </div>
          </div>

          <div className="space-y-4">
            {/* Mobile menu and notification history */}
            <div className="flex items-center justify-between md:justify-end gap-2">
              <div className="md:hidden">
                <Sheet>
                  <SheetTrigger asChild>
                    <Button variant="outline" className="h-10 gap-2 px-3 text-sm">
                      <Menu className="h-4 w-4 shrink-0" />
                      <span className="whitespace-nowrap">Menu admin</span>
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="flex h-dvh w-[min(88vw,340px)] min-w-[280px] max-w-[calc(100vw-1rem)] flex-col overflow-hidden p-0">
                    <SheetHeader className="shrink-0 border-b border-border px-4 pb-3 pt-[calc(1rem+env(safe-area-inset-top))] text-left">
                      <SheetTitle className="truncate text-base">Menu quản trị</SheetTitle>
                    </SheetHeader>
                    <div className="min-h-0 flex-1">
                      <AdminSidebar 
                        onNavigate={() => undefined}
                        pendingVerificationCount={pendingVerificationCount}
                        pendingTransactionCount={pendingTransactionCount}
                        pendingOptionTradeCount={pendingOptionTradeCount}
                        newUserCount={newUserCount}
                      />
                    </div>
                  </SheetContent>
                </Sheet>
              </div>

              {/* Live Chat Admin Button - hide on dedicated live-chat page */}
              {!isLiveChatPage && (
                <LiveChatAdminSheet 
                  trigger={
                    <Button variant="outline" size="sm" className="gap-2">
                      <MessageCircle className="h-4 w-4" />
                      <span className="hidden sm:inline">Live Chat</span>
                    </Button>
                  }
                />
              )}

              {/* Notification Bell - Now includes both user and admin notifications */}
              <NotificationBell />
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
