import { DashboardNews } from "@/components/dashboard/DashboardNews";

export default function AdminNews() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Tin tức</h1>
        <p className="text-sm text-muted-foreground">Tạo/sửa/xoá bài viết.</p>
      </div>
      <DashboardNews />
    </div>
  );
}
