import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Loader2, RefreshCw, Send, PlayCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";

type OutboxRow = {
  id: number;
  status: string;
  attempts: number;
  source: string | null;
  created_at: string;
  sent_at: string | null;
  last_error: string | null;
  payload: { title?: string; message?: string } | null;
};

function TelegramOutboxPanel() {
  const [outbox, setOutbox] = useState<OutboxRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [enqueuing, setEnqueuing] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const fetchOutbox = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("telegram_outbox")
      .select("id,status,attempts,source,created_at,sent_at,last_error,payload")
      .order("created_at", { ascending: false })
      .limit(15);
    setLoading(false);
    if (error) {
      toast({ title: "Lỗi tải outbox", description: error.message, variant: "destructive" });
      return;
    }
    setOutbox((data ?? []) as OutboxRow[]);
  };

  useEffect(() => {
    fetchOutbox();
  }, []);

  const runProcessor = async () => {
    setProcessing(true);
    setLastResult(null);
    const t0 = performance.now();
    const { data, error } = await supabase.functions.invoke("process-telegram-outbox", { body: {} });
    const ms = Math.round(performance.now() - t0);
    setProcessing(false);
    if (error) {
      setLastResult(`❌ Lỗi: ${error.message}`);
      toast({ title: "Processor lỗi", description: error.message, variant: "destructive" });
    } else {
      const summary = `✅ ${ms}ms · processed=${data?.processed ?? 0} · sent=${data?.sent ?? 0} · failed=${data?.failed ?? 0}`;
      setLastResult(summary);
      toast({ title: "Đã chạy processor", description: summary });
    }
    fetchOutbox();
  };

  const enqueueTest = async () => {
    setEnqueuing(true);
    const { error } = await supabase.rpc("enqueue_telegram", {
      _payload: {
        type: "notification",
        title: "🧪 Test Telegram",
        message: `Tin thử nghiệm lúc ${new Date().toLocaleTimeString("vi-VN")}`,
        notification_type: "info",
        user_email: "admin-test",
      },
      _source: "manual_test",
    });
    setEnqueuing(false);
    if (error) {
      toast({ title: "Lỗi enqueue", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Đã thêm tin test vào outbox" });
      fetchOutbox();
    }
  };

  const statusBadge = (s: string) => {
    if (s === "sent") return <Badge className="bg-green-600 hover:bg-green-600">sent</Badge>;
    if (s === "failed") return <Badge variant="destructive">failed</Badge>;
    return <Badge variant="secondary">pending</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Send className="w-4 h-4" /> Telegram Outbox
          </CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" variant="outline" onClick={enqueueTest} disabled={enqueuing}>
              {enqueuing ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Send className="w-3 h-3 mr-1" />}
              Gửi tin test
            </Button>
            <Button size="sm" onClick={runProcessor} disabled={processing}>
              {processing ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <PlayCircle className="w-3 h-3 mr-1" />}
              Chạy processor
            </Button>
            <Button size="sm" variant="ghost" onClick={fetchOutbox} disabled={loading}>
              <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
        {lastResult && (
          <div className="text-xs text-muted-foreground font-mono pt-1">{lastResult}</div>
        )}
      </CardHeader>
      <CardContent>
        {outbox.length === 0 ? (
          <div className="text-sm text-muted-foreground py-4 text-center">
            Chưa có tin nào trong outbox. Bấm "Gửi tin test" để thử.
          </div>
        ) : (
          <div className="divide-y text-sm">
            {outbox.map((r) => (
              <div key={r.id} className="py-2 flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {statusBadge(r.status)}
                    <span className="text-xs text-muted-foreground">#{r.id}</span>
                    {r.source && <span className="text-xs text-muted-foreground">· {r.source}</span>}
                    <span className="text-xs text-muted-foreground">· try {r.attempts}</span>
                  </div>
                  <div className="truncate font-medium mt-0.5">{r.payload?.title ?? "(no title)"}</div>
                  <div className="text-xs text-muted-foreground truncate whitespace-pre-line">
                    {(r.payload?.message ?? "").slice(0, 120)}
                  </div>
                  {r.last_error && (
                    <div className="text-xs text-destructive truncate" title={r.last_error}>
                      {r.last_error}
                    </div>
                  )}
                </div>
                <div className="text-[10px] text-muted-foreground text-right shrink-0">
                  <div>{new Date(r.created_at).toLocaleTimeString("vi-VN")}</div>
                  {r.sent_at && (
                    <div className="text-green-600">→ {new Date(r.sent_at).toLocaleTimeString("vi-VN")}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

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
      <TelegramOutboxPanel />
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