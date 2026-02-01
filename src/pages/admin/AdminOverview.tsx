import { DashboardStats } from "@/components/dashboard/DashboardStats";
import { AdminSendNotification } from "@/components/admin/AdminSendNotification";

export default function AdminOverview() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Tổng quan</h1>
          <p className="text-sm text-muted-foreground">
            Thống kê nhanh và biểu đồ hoạt động.
          </p>
        </div>
        <AdminSendNotification />
      </div>
      <DashboardStats />
    </div>
  );
}
