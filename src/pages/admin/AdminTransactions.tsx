import { DashboardTransactions } from "@/components/dashboard/DashboardTransactions";

export default function AdminTransactions() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Giao dịch</h1>
        <p className="text-sm text-muted-foreground">
          Duyệt nạp/rút và xem chi tiết.
        </p>
      </div>
      <DashboardTransactions />
    </div>
  );
}
