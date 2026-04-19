import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DashboardCharity } from "@/components/dashboard/DashboardCharity";
import { DashboardSavings } from "@/components/dashboard/DashboardSavings";
import { Heart, PiggyBank } from "lucide-react";

export default function AdminCharity() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Từ thiện & Tiết kiệm</h1>
        <p className="text-sm text-muted-foreground">Quản lý các chương trình từ thiện và gói tiết kiệm có kỳ hạn.</p>
      </div>

      <Tabs defaultValue="charity" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="charity" className="gap-2">
            <Heart className="w-4 h-4" /> Từ thiện
          </TabsTrigger>
          <TabsTrigger value="savings" className="gap-2">
            <PiggyBank className="w-4 h-4" /> Gói tiết kiệm
          </TabsTrigger>
        </TabsList>

        <TabsContent value="charity" className="mt-4">
          <DashboardCharity />
        </TabsContent>

        <TabsContent value="savings" className="mt-4">
          <DashboardSavings />
        </TabsContent>
      </Tabs>
    </div>
  );
}
