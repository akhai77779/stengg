import { DashboardStats } from "@/components/dashboard/DashboardStats";
import { MessageCircle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function AdminOverview() {
  const handleOpenCSKHAdmin = () => {
    window.open("https://support.stengg.it.com/admin", "_blank", "noopener,noreferrer");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">Tổng quan</h1>
          <p className="text-sm text-muted-foreground">
            Thống kê nhanh và biểu đồ hoạt động.
          </p>
        </div>
        
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-3">
            <Button 
              onClick={handleOpenCSKHAdmin}
              className="w-full gap-2"
              variant="default"
            >
              <MessageCircle className="h-4 w-4" />
              Admin CSKH
              <ExternalLink className="h-3 w-3 ml-1" />
            </Button>
          </CardContent>
        </Card>
      </div>
      <DashboardStats />
    </div>
  );
}
