import { DashboardUsers } from "@/components/dashboard/DashboardUsers";

export default function AdminUsers() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Người dùng</h1>
        <p className="text-sm text-muted-foreground">
          Danh sách người dùng và vai trò.
        </p>
      </div>
      <DashboardUsers />
    </div>
  );
}
