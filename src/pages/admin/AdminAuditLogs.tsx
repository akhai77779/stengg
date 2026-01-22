import { DashboardAuditLogs } from "@/components/dashboard/DashboardAuditLogs";

export default function AdminAuditLogs() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Audit logs</h1>
        <p className="text-sm text-muted-foreground">
          Theo dõi lịch sử hành động quản trị.
        </p>
      </div>
      <DashboardAuditLogs />
    </div>
  );
}
