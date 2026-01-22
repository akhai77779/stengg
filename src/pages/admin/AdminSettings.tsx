import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

type SettingsState = {
  usdToVnd: string;
  withdrawalFeePercent: string;
  bannersEnabled: boolean;
};

const KEYS = ["exchange_rates", "withdrawal_fee", "banners_enabled"] as const;

export default function AdminSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [state, setState] = useState<SettingsState>({
    usdToVnd: "25000",
    withdrawalFeePercent: "1",
    bannersEnabled: true,
  });

  const parsed = useMemo(() => {
    const usdToVndNum = Number(state.usdToVnd);
    const feeNum = Number(state.withdrawalFeePercent);
    return {
      usdToVndNum,
      feeNum,
      usdToVndValid: Number.isFinite(usdToVndNum) && usdToVndNum > 0,
      feeValid: Number.isFinite(feeNum) && feeNum >= 0,
    };
  }, [state.usdToVnd, state.withdrawalFeePercent]);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("app_settings")
          .select("key,value")
          .in("key", [...KEYS]);

        if (error) throw error;

        const map = new Map<string, unknown>();
        (data ?? []).forEach((row) => map.set(row.key, row.value));

        const exchangeRates = map.get("exchange_rates") as
          | { usd_to_vnd?: number }
          | undefined;
        const withdrawalFee = map.get("withdrawal_fee") as
          | { percent?: number }
          | undefined;
        const bannersEnabled = map.get("banners_enabled") as
          | { enabled?: boolean }
          | undefined;

        if (!mounted) return;
        setState((s) => ({
          ...s,
          usdToVnd: String(exchangeRates?.usd_to_vnd ?? 25000),
          withdrawalFeePercent: String(withdrawalFee?.percent ?? 1),
          bannersEnabled: Boolean(bannersEnabled?.enabled ?? true),
        }));
      } catch (e) {
        console.error(e);
        toast.error("Không tải được cấu hình. Vui lòng thử lại.");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, []);

  const save = async () => {
    if (!parsed.usdToVndValid) {
      toast.error("Tỷ giá USD→VND không hợp lệ");
      return;
    }
    if (!parsed.feeValid) {
      toast.error("Phí rút không hợp lệ");
      return;
    }

    setSaving(true);
    try {
      const payload = [
        { key: "exchange_rates", value: { usd_to_vnd: parsed.usdToVndNum } },
        { key: "withdrawal_fee", value: { percent: parsed.feeNum } },
        { key: "banners_enabled", value: { enabled: state.bannersEnabled } },
      ];

      const { error } = await supabase
        .from("app_settings")
        .upsert(payload, { onConflict: "key" });

      if (error) throw error;
      toast.success("Đã lưu cấu hình");
    } catch (e) {
      console.error(e);
      toast.error("Lưu cấu hình thất bại. Vui lòng thử lại.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Cấu hình hệ thống</h1>
        <p className="text-sm text-muted-foreground">
          Chỉnh các cấu hình chung và lưu vào cơ sở dữ liệu.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Thiết lập</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-3">
            <Label htmlFor="usdToVnd">Tỷ giá USD → VND</Label>
            <Input
              id="usdToVnd"
              inputMode="numeric"
              value={state.usdToVnd}
              disabled={loading}
              onChange={(e) => setState((s) => ({ ...s, usdToVnd: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground">
              Dùng cho hiển thị/qui đổi tiền tệ trong ứng dụng.
            </p>
          </div>

          <Separator />

          <div className="grid gap-3">
            <Label htmlFor="withdrawFee">Phí rút (%)</Label>
            <Input
              id="withdrawFee"
              inputMode="decimal"
              value={state.withdrawalFeePercent}
              disabled={loading}
              onChange={(e) =>
                setState((s) => ({ ...s, withdrawalFeePercent: e.target.value }))
              }
            />
            <p className="text-xs text-muted-foreground">
              Hiện tại chỉ lưu cấu hình (chưa áp dụng vào logic rút tiền).
            </p>
          </div>

          <Separator />

          <div className="flex items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-sm font-medium">Bật/tắt banner toàn site</div>
              <div className="text-xs text-muted-foreground">
                Hiện tại chỉ lưu cấu hình (chưa ẩn/hiện banner tự động).
              </div>
            </div>
            <Switch
              checked={state.bannersEnabled}
              disabled={loading}
              onCheckedChange={(checked) =>
                setState((s) => ({ ...s, bannersEnabled: checked }))
              }
            />
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button
              onClick={save}
              disabled={loading || saving}
              className="min-w-[140px]"
            >
              {saving ? "Đang lưu..." : "Lưu cấu hình"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
