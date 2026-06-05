import { useMemo, useState, type ComponentType } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
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
  Activity,
  Zap,
  ChevronRight,
  Shield,
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
  badgeKey?: "verification" | "transaction" | "option_trade" | "new_user";
  group?: string;
};

interface AdminSidebarProps {
  onNavigate?: () => void;
  pendingVerificationCount: number;
  pendingTransactionCount: number;
  pendingOptionTradeCount: number;
  newUserCount: number;
}

const NAV_GROUPS = [
  { key: "monitor", label: "MONITORING" },
  { key: "content", label: "CONTENT" },
  { key: "finance", label: "FINANCE" },
  { key: "system", label: "SYSTEM" },
];

function AdminSidebar({
  onNavigate,
  pendingVerificationCount,
  pendingTransactionCount,
  pendingOptionTradeCount,
  newUserCount,
}: AdminSidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();

  const items: AdminNavItem[] = useMemo(
    () => [
      { to: "/admin/overview", label: "Overview", icon: BarChart3, group: "monitor" },
      { to: "/admin/products-monitor", label: "Market Monitor", icon: LayoutDashboard, group: "monitor" },
      { to: "/admin/shock-events", label: "Shock Events", icon: Zap, group: "monitor" },
      { to: "/admin/data-health", label: "Data Health", icon: Activity, group: "monitor" },
      { to: "/admin/live-chat", label: "Live Chat", icon: MessageCircle, group: "content" },
      { to: "/admin/banners", label: t("admin.banners"), icon: ImageIcon, group: "content" },
      { to: "/admin/news", label: t("admin.news"), icon: Newspaper, group: "content" },
      { to: "/admin/products", label: t("admin.products"), icon: Package, group: "content" },
      { to: "/admin/charity", label: t("admin.charity"), icon: Heart, group: "content" },
      { to: "/admin/charity-donations", label: "Quyên góp", icon: Heart, group: "content" },
      {
        to: "/admin/transactions",
        label: t("admin.transactions"),
        icon: CreditCard,
        group: "finance",
        badgeKey: "transaction",
      },
      { to: "/admin/option-trades", label: "Option Trades", icon: Clock, group: "finance", badgeKey: "option_trade" },
      {
        to: "/admin/identity-verifications",
        label: t("admin.identityVerifications"),
        icon: UserCheck,
        group: "system",
        badgeKey: "verification",
      },
      { to: "/admin/users", label: t("admin.users"), icon: Users, group: "system", badgeKey: "new_user" },
      { to: "/admin/audit-logs", label: t("admin.auditLogs"), icon: ClipboardList, group: "system" },
      { to: "/admin/settings", label: t("admin.settings"), icon: Settings, group: "system" },
    ],
    [t],
  );

  const getBadgeCount = (badgeKey?: string) => {
    if (badgeKey === "verification") return pendingVerificationCount;
    if (badgeKey === "transaction") return pendingTransactionCount;
    if (badgeKey === "option_trade") return pendingOptionTradeCount;
    if (badgeKey === "new_user") return newUserCount;
    return 0;
  };

  const totalBadge = pendingVerificationCount + pendingTransactionCount + pendingOptionTradeCount + newUserCount;

  return (
    <aside className="flex h-full min-h-0 flex-col bg-[#0d1117]">
      {/* Logo area */}
      <div className="shrink-0 px-4 py-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div>
            <p className="text-xs font-semibold text-white tracking-wider">ADMIN</p>
            <p className="text-[10px] text-white/30 tracking-widest uppercase">Control Panel</p>
          </div>
          {totalBadge > 0 && (
            <Badge className="ml-auto h-5 min-w-5 px-1.5 text-[10px] bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse">
              {totalBadge}
            </Badge>
          )}
        </div>
      </div>

      {/* Nav */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        {NAV_GROUPS.map((group) => {
          const groupItems = items.filter((i) => i.group === group.key);
          if (!groupItems.length) return null;
          return (
            <div key={group.key} className="mb-1">
              <div className="px-4 py-1.5">
                <span className="text-[9px] font-bold tracking-[0.12em] text-white/20">{group.label}</span>
              </div>
              {groupItems.map((item) => {
                const active = location.pathname === item.to;
                const Icon = item.icon;
                const count = getBadgeCount(item.badgeKey);
                return (
                  <button
                    key={item.to}
                    onClick={() => {
                      navigate(item.to);
                      onNavigate?.();
                    }}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-3 mx-1 py-2 rounded-md text-sm transition-all duration-150 group",
                      "w-[calc(100%-8px)]",
                      active
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        : "text-white/45 hover:text-white/80 hover:bg-white/[0.04] border border-transparent",
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-3.5 w-3.5 shrink-0 transition-colors",
                        active ? "text-emerald-400" : "text-white/30 group-hover:text-white/60",
                      )}
                    />
                    <span className="flex-1 text-left text-[13px] leading-none font-medium truncate">{item.label}</span>
                    {count > 0 ? (
                      <Badge className="h-4 min-w-4 px-1 text-[10px] bg-red-500/20 text-red-400 border border-red-500/30">
                        {count}
                      </Badge>
                    ) : active ? (
                      <ChevronRight className="h-3 w-3 text-emerald-500/50" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </aside>
  );
}

export default function AdminLayout() {
  const { pendingVerificationCount, pendingTransactionCount, pendingOptionTradeCount, newUserCount } =
    useAdminNotifications();
  const location = useLocation();
  const isLiveChatPage = location.pathname === "/admin/live-chat";

  return (
    <Layout hideFooter={isLiveChatPage}>
      <div className="min-h-screen bg-[#080c10]">
        <div className="flex">
          {/* Desktop Sidebar — fixed width, full height */}
          <div className="hidden md:flex md:w-[220px] md:flex-shrink-0 md:flex-col sticky top-16 h-[calc(100vh-64px)] border-r border-white/[0.05] overflow-hidden">
            <AdminSidebar
              pendingVerificationCount={pendingVerificationCount}
              pendingTransactionCount={pendingTransactionCount}
              pendingOptionTradeCount={pendingOptionTradeCount}
              newUserCount={newUserCount}
            />
          </div>

          {/* Main content */}
          <div className="flex-1 min-w-0">
            {/* Top bar */}
            <div className="sticky top-16 z-10 flex items-center justify-between gap-2 px-4 py-2 border-b border-white/[0.05] bg-[#080c10]/95 backdrop-blur-sm md:px-6">
              {/* Mobile menu */}
              <div className="md:hidden">
                <Sheet>
                  <SheetTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-2 px-2.5 text-xs border-white/10 bg-white/5 hover:bg-white/10 text-white/70"
                    >
                      <Menu className="h-3.5 w-3.5" />
                      Menu
                    </Button>
                  </SheetTrigger>
                  <SheetContent
                    side="left"
                    className="flex h-dvh w-[min(88vw,280px)] flex-col overflow-hidden p-0 border-r border-white/[0.07] bg-[#0d1117]"
                  >
                    <SheetHeader className="shrink-0 border-b border-white/[0.06] px-4 pb-3 pt-[calc(1rem+env(safe-area-inset-top))] text-left">
                      <SheetTitle className="text-sm text-white/60">Menu quản trị</SheetTitle>
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

              {/* Right actions */}
              <div className="flex items-center gap-2 ml-auto">
                {!isLiveChatPage && (
                  <LiveChatAdminSheet
                    trigger={
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1.5 px-2.5 text-xs border-white/10 bg-white/5 hover:bg-white/10 text-white/60"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Live Chat</span>
                      </Button>
                    }
                  />
                )}
                <NotificationBell />
              </div>
            </div>

            {/* Page content */}
            <div className="p-2 sm:p-4 md:p-6">
              <div className="md:rounded-xl md:border md:border-white/[0.06] md:bg-[#0d1117] md:overflow-hidden">
                <Outlet />
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
