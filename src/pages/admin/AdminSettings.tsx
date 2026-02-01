import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { RefreshCw, CheckCircle2, XCircle, Loader2 } from "lucide-react";

type SettingsState = {
  usdToVnd: string;
  withdrawalFeePercent: string;
  bannersEnabled: boolean;
  supportEnabled: boolean;
};

const KEYS = [
  "exchange_rates",
  "withdrawal_fee",
  "banners_enabled",
  "support_enabled",
] as const;

export default function AdminSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{
    success: boolean;
    results?: {
      banners: { synced: number; errors: number; skipped: number };
      products: { synced: number; errors: number; skipped: number };
      news: { synced: number; errors: number; skipped: number };
    };
  } | null>(null);
  const [state, setState] = useState<SettingsState>({
    usdToVnd: "25000",
    withdrawalFeePercent: "1",
    bannersEnabled: true,
    supportEnabled: true,
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
        const supportEnabled = map.get("support_enabled") as
          | { enabled?: boolean }
          | undefined;

        if (!mounted) return;
        setState((s) => ({
          ...s,
          usdToVnd: String(exchangeRates?.usd_to_vnd ?? 25000),
          withdrawalFeePercent: String(withdrawalFee?.percent ?? 1),
          bannersEnabled: Boolean(bannersEnabled?.enabled ?? true),
          supportEnabled: Boolean(supportEnabled?.enabled ?? true),
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
        { key: "support_enabled", value: { enabled: state.supportEnabled } },
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

  const syncExternalData = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("sync-external-data");
      
      if (error) {
        console.error("Sync error:", error);
        toast.error("Đồng bộ thất bại: " + error.message);
        setSyncResult({ success: false });
        return;
      }

      if (data?.success) {
        toast.success("Đồng bộ dữ liệu thành công!");
        setSyncResult({
          success: true,
          results: data.results,
        });
      } else {
        toast.error("Đồng bộ thất bại: " + (data?.error || "Unknown error"));
        setSyncResult({ success: false });
      }
    } catch (e) {
      console.error("Sync error:", e);
      toast.error("Đồng bộ thất bại. Vui lòng thử lại.");
      setSyncResult({ success: false });
    } finally {
      setSyncing(false);
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

          <div className="flex items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-sm font-medium">Bật/tắt Support ST Engineering (mobile)</div>
              <div className="text-xs text-muted-foreground">
                Khi tắt, icon Support sẽ bị ẩn trên mobile.
              </div>
            </div>
            <Switch
              checked={state.supportEnabled}
              disabled={loading}
              onCheckedChange={(checked) =>
                setState((s) => ({ ...s, supportEnabled: checked }))
              }
            />
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

      {/* Sync External Data Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5" />
            Đồng bộ dữ liệu
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Đồng bộ dữ liệu từ API bên ngoài (products, news, banners, option times).
          </p>

          <Button
            onClick={syncExternalData}
            disabled={syncing}
            variant="outline"
            className="gap-2"
          >
            {syncing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Đang đồng bộ...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                Đồng bộ ngay
              </>
            )}
          </Button>

          {syncResult && (
            <div className={`p-4 rounded-lg border ${syncResult.success ? 'bg-green-500/10 border-green-500/30' : 'bg-destructive/10 border-destructive/30'}`}>
              <div className="flex items-center gap-2 mb-3">
                {syncResult.success ? (
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                ) : (
                  <XCircle className="w-5 h-5 text-destructive" />
                )}
                <span className={`font-medium ${syncResult.success ? 'text-green-500' : 'text-destructive'}`}>
                  {syncResult.success ? 'Đồng bộ thành công!' : 'Đồng bộ thất bại'}
                </span>
              </div>

              {syncResult.results && (
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div className="space-y-1">
                    <div className="font-medium">Products</div>
                    <div className="text-muted-foreground">
                      ✓ {syncResult.results.products.synced} synced
                    </div>
                    {syncResult.results.products.errors > 0 && (
                      <div className="text-destructive">
                        ✗ {syncResult.results.products.errors} errors
                      </div>
                    )}
                  </div>
                  <div className="space-y-1">
                    <div className="font-medium">News</div>
                    <div className="text-muted-foreground">
                      ✓ {syncResult.results.news.synced} synced
                    </div>
                    {syncResult.results.news.errors > 0 && (
                      <div className="text-destructive">
                        ✗ {syncResult.results.news.errors} errors
                      </div>
                    )}
                  </div>
                  <div className="space-y-1">
                    <div className="font-medium">Banners</div>
                    <div className="text-muted-foreground">
                      ✓ {syncResult.results.banners.synced} synced
                    </div>
                    {syncResult.results.banners.errors > 0 && (
                      <div className="text-destructive">
                        ✗ {syncResult.results.banners.errors} errors
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
