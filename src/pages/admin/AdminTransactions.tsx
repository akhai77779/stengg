import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardTransactions } from "@/components/dashboard/DashboardTransactions";
import { BankQuayMonitor } from "@/components/admin/BankQuayMonitor";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function AdminTransactions() {
  const queryClient = useQueryClient();

  // Fetch bankquay_enabled setting
  const { data: bankquayEnabled, isLoading: settingLoading } = useQuery({
    queryKey: ["bankquay-enabled-setting"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "bankquay_enabled")
        .maybeSingle();
      if (error) throw error;
      // Default to false if not set
      if (!data) return false;
      return (data.value as { enabled?: boolean })?.enabled ?? false;
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      // Upsert the setting
      const { data: existing } = await supabase
        .from("app_settings")
        .select("id")
        .eq("key", "bankquay_enabled")
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("app_settings")
          .update({ value: { enabled }, updated_at: new Date().toISOString() })
          .eq("key", "bankquay_enabled");
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("app_settings")
          .insert({ key: "bankquay_enabled", value: { enabled } });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bankquay-enabled-setting"] });
      toast.success("Đã cập nhật trạng thái BankQuay");
    },
    onError: () => {
      toast.error("Không thể cập nhật. Thử lại sau.");
    },
  });

  const isEnabled = bankquayEnabled ?? false;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Giao dịch Nạp/Rút</h1>
        <p className="text-sm text-muted-foreground">
          Duyệt nạp/rút và xem chi tiết.
        </p>
      </div>

      {/* BankQuay Toggle */}
      <Card>
        <CardContent className="flex items-center justify-between py-4 px-5">
          <div className="space-y-0.5">
            <Label className="text-sm font-medium">Nạp tiền tự động (BankQuay)</Label>
            <p className="text-xs text-muted-foreground">
              {isEnabled
                ? "Đang bật — Người dùng sẽ thấy trang nạp tiền QR"
                : "Đang tắt — Người dùng sẽ thấy \"Liên hệ CSKH\""}
            </p>
          </div>
          {settingLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Switch
              checked={isEnabled}
              onCheckedChange={(checked) => toggleMutation.mutate(checked)}
              disabled={toggleMutation.isPending}
            />
          )}
        </CardContent>
      </Card>

      {/* BankQuay Monitor - always visible for admin */}
      <BankQuayMonitor />

      <DashboardTransactions />
    </div>
  );
}
