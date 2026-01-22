import { DashboardProducts } from "@/components/dashboard/DashboardProducts";

export default function AdminProducts() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Sản phẩm</h1>
        <p className="text-sm text-muted-foreground">
          Quản lý danh sách sản phẩm giao dịch.
        </p>
      </div>
      <DashboardProducts />
    </div>
  );
}
