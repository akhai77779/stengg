import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Loader2, RefreshCw } from "lucide-react";

const TABLES = [
  "profiles",
  "user_roles",
  "products",
  "price_history",
  "option_trades",
  "transactions",
  "bank_accounts",
  "live_chat_rooms",
  "live_chat_messages",
  "news",
  "banners",
  "charity_programs",
  "savings_packages",
  "app_settings",
  "audit_logs",
] as const;

type Row = {
  table: string;
  status: "pending" | "ok" | "error";
  count: number | null;
  error?: string;
  ms?: number;
};

export default function AdminDataHealth() {
  const [rows, setRows] = useState<Row[]>(
    TABLES.map((t) => ({ table: t, status: "pending", count: null }))
  );
  const [running, setRunning] = useState(false);
  const [startedAt, setStartedAt] = useState<Date | null>(null);

  const runCheck = async () => {
    setRunning(true);
    setStartedAt(new Date());
    setRows(TABLES.map((t) => ({ table: t, status: "pending", count: null })));

    const results = await Promise.all(
      TABLES.map(async (table): Promise<Row> => {
        const t0 = performance.now();
        try {
          const { count, error } = await supabase
            .from(table as never)
            .select("*", { count: "exact", head: true });
          const ms = Math.round(performance.now() - t0);
          if (error) {
            return { table, status: "error", count: null, error: error.message, ms };
          }
          return { table, status: "ok", count: count ?? 0, ms };
        } catch (e) {
          return {
            table,
            status: "error",
            count: null,
            error: e instanceof Error ? e.message : String(e),
            ms: Math.round(performance.now() - t0),
          };
        }
      })
    );
    setRows(results);
    setRunning(false);
  };

  useEffect(() => {
    runCheck();
  }, []);

  const okCount = rows.filter((r) => r.status === "ok").length;
  const errorCount = rows.filter((r) => r.status === "error").length;
  const totalRecords = rows.reduce((sum, r) => sum + (r.count ?? 0), 0);

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">Kiểm tra dữ liệu Cloud</h1>
          <p className="text-sm text-muted-foreground">
            Xác nhận database còn nguyên sau khi nâng instance.
          </p>
        </div>
        <Button onClick={runCheck} disabled={running} size="sm">
          {running ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-2" />
          )}
          Chạy lại
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4">
            <div className="text-xs text-muted-foreground">Bảng OK</div>
            <div className="text-2xl font-bold text-green-600">{okCount}/{rows.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-xs text-muted-foreground">Bảng lỗi</div>
            <div className="text-2xl font-bold text-destructive">{errorCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-xs text-muted-foreground">Tổng bản ghi</div>
            <div className="text-2xl font-bold">{totalRecords.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-xs text-muted-foreground">Lần chạy</div>
            <div className="text-sm font-medium">
              {startedAt ? startedAt.toLocaleTimeString("vi-VN") : "-"}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Chi tiết theo bảng</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y">
            {rows.map((r) => (
              <div key={r.table} className="flex items-center justify-between py-2 gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  {r.status === "pending" && (
                    <Loader2 className="w-4 h-4 text-muted-foreground animate-spin shrink-0" />
                  )}
                  {r.status === "ok" && (
                    <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                  )}
                  {r.status === "error" && (
                    <XCircle className="w-4 h-4 text-destructive shrink-0" />
                  )}
                  <span className="font-mono text-sm truncate">{r.table}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {r.ms != null && (
                    <span className="text-xs text-muted-foreground">{r.ms}ms</span>
                  )}
                  {r.status === "ok" && (
                    <Badge variant="secondary" className="tabular-nums">
                      {(r.count ?? 0).toLocaleString()} dòng
                    </Badge>
                  )}
                  {r.status === "error" && (
                    <Badge variant="destructive" className="max-w-[200px] truncate" title={r.error}>
                      {r.error}
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}