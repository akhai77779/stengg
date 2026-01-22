import { DashboardBanners } from "@/components/dashboard/DashboardBanners";

export default function AdminBanners() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Banners</h1>
        <p className="text-sm text-muted-foreground">
          Quản lý banner hiển thị trên trang chủ.
        </p>
      </div>
      <DashboardBanners />
    </div>
  );
}
