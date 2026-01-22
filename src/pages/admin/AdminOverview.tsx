import { DashboardStats } from "@/components/dashboard/DashboardStats";

export default function AdminOverview() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Tổng quan</h1>
        <p className="text-sm text-muted-foreground">
          Thống kê nhanh và biểu đồ hoạt động.
        </p>
      </div>
      <DashboardStats />
    </div>
  );
}
