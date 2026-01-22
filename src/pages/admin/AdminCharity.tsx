import { DashboardCharity } from "@/components/dashboard/DashboardCharity";

export default function AdminCharity() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Từ thiện</h1>
        <p className="text-sm text-muted-foreground">Quản lý chương trình.</p>
      </div>
      <DashboardCharity />
    </div>
  );
}
