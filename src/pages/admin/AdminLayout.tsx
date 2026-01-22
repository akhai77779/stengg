import { useEffect, useMemo, type ComponentType } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
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
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

type AdminNavItem = {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
};

function AdminSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const navigate = useNavigate();
  const location = useLocation();

  const items: AdminNavItem[] = useMemo(
    () => [
      { to: "/admin/overview", label: "Tổng quan", icon: BarChart3 },
      { to: "/admin/banners", label: "Banners", icon: ImageIcon },
      { to: "/admin/news", label: "Tin tức", icon: Newspaper },
      { to: "/admin/products", label: "Sản phẩm", icon: Package },
      { to: "/admin/charity", label: "Từ thiện", icon: Heart },
      { to: "/admin/transactions", label: "Giao dịch", icon: CreditCard },
      { to: "/admin/audit-logs", label: "Audit logs", icon: ClipboardList },
      { to: "/admin/users", label: "Người dùng", icon: Users },
      { to: "/admin/settings", label: "Cấu hình", icon: Settings },
    ],
    []
  );

  return (
    <aside className="h-full">
      <div className="p-4">
        <div className="text-sm font-semibold tracking-wide text-muted-foreground">
          Quản trị
        </div>
      </div>
      <div className="px-2 pb-4">
        {items.map((item) => {
          const active = location.pathname === item.to;
          const Icon = item.icon;
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
              {item.label}
            </Button>
          );
        })}
      </div>
    </aside>
  );
}

export default function AdminLayout() {
  const { user, isAdmin, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (authLoading) return;
    if (!user) navigate("/login");
    else if (!isAdmin) navigate("/");
  }, [authLoading, user, isAdmin, navigate]);

  if (authLoading) return null;
  if (!user || !isAdmin) return null;

  return (
    <Layout>
      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-6">
          <div className="hidden md:block">
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <AdminSidebar />
            </div>
          </div>

          <div className="space-y-4">
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
                    <AdminSidebar onNavigate={() => undefined} />
                  </div>
                </SheetContent>
              </Sheet>
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
