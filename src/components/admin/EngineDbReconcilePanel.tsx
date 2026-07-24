import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RefreshCw, Trash2, ShieldCheck, AlertTriangle, XCircle } from 'lucide-react';
import {
  __readSharedProductCacheEntry,
  clearSharedProductCache,
  cacheKey,
} from '@/hooks/useSharedProductRealtime';
import { toast } from '@/hooks/use-toast';

interface DbProductRow {
  id: string;
  symbol: string | null;
  name: string;
  price: number | null;
}

interface DbLatestRow {
  product_id: string;
  recorded_at: string;
  close_price: number;
}

interface ReconcileRow {
  productId: string;
  symbol: string;
  dbPrice: number | null;
  dbLatestCandleClose: number | null;
  dbLatestCandleAt: string | null;
  clientCachedClose: number | null;
  clientCachedAt: string | null;
  clientAnchor: number | null;
  driftPct: number | null; // vs dbLatestCandleClose
  minuteLag: number | null;
  status: 'ok' | 'warn' | 'drift' | 'no-cache';
}

function pctDiff(a: number, b: number): number {
  if (!b) return 0;
  return Math.abs(a - b) / Math.abs(b);
}

function minutesBetween(aIso: string, bIso: string): number {
  const a = new Date(aIso).getTime();
  const b = new Date(bIso).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.round((a - b) / 60000);
}

function classify(row: Omit<ReconcileRow, 'status'>): ReconcileRow['status'] {
  if (row.clientCachedClose == null) return 'no-cache';
  const d = row.driftPct ?? 0;
  const lag = Math.abs(row.minuteLag ?? 0);
  if (d > 0.01 || lag >= 3) return 'drift';
  if (d > 0.003 || lag >= 1) return 'warn';
  return 'ok';
}

export function EngineDbReconcilePanel() {
  const [rows, setRows] = useState<ReconcileRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastRunAt, setLastRunAt] = useState<number | null>(null);

  const run = useCallback(async () => {
    setLoading(true);
    try {
      const { data: products, error: pErr } = await supabase
        .from('products')
        .select('id, symbol, name, price')
        .eq('status', 'available')
        .order('name', { ascending: true });
      if (pErr) throw pErr;
      const pList = (products || []) as DbProductRow[];
      if (pList.length === 0) {
        setRows([]);
        return;
      }

      // Fetch latest 1m row per product. Simple: get last 5 rows/product via one broad query.
      const ids = pList.map(p => p.id);
      const since = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      const { data: history, error: hErr } = await supabase
        .from('price_history')
        .select('product_id, recorded_at, close_price')
        .in('product_id', ids)
        .gte('recorded_at', since)
        .order('recorded_at', { ascending: false })
        .limit(1000);
      if (hErr) throw hErr;

      const latestByProduct = new Map<string, DbLatestRow>();
      for (const r of (history || []) as DbLatestRow[]) {
        if (!latestByProduct.has(r.product_id)) latestByProduct.set(r.product_id, r);
      }

      const nowIso = new Date().toISOString();
      const built: ReconcileRow[] = pList.map(p => {
        const dbLatest = latestByProduct.get(p.id) || null;
        const cache = __readSharedProductCacheEntry(cacheKey(p.id));
        const cachedLastRow = cache?.rows?.[cache.rows.length - 1] || null;
        const clientCachedClose = cachedLastRow ? Number(cachedLastRow.close_price) : null;
        const clientCachedAt = cachedLastRow ? cachedLastRow.recorded_at : null;
        const clientAnchor = cache?.anchorPrice ?? null;

        const dbLatestCandleClose = dbLatest ? Number(dbLatest.close_price) : null;
        const dbLatestCandleAt = dbLatest ? dbLatest.recorded_at : null;

        const driftPct =
          clientCachedClose != null && dbLatestCandleClose != null
            ? pctDiff(clientCachedClose, dbLatestCandleClose)
            : null;
        const minuteLag =
          clientCachedAt && dbLatestCandleAt
            ? minutesBetween(dbLatestCandleAt, clientCachedAt)
            : null;

        const base: Omit<ReconcileRow, 'status'> = {
          productId: p.id,
          symbol: p.symbol || p.name,
          dbPrice: p.price != null ? Number(p.price) : null,
          dbLatestCandleClose,
          dbLatestCandleAt,
          clientCachedClose,
          clientCachedAt,
          clientAnchor,
          driftPct,
          minuteLag,
        };
        return { ...base, status: classify(base) };
      });

      // eslint-disable-next-line no-void
      void nowIso;
      setRows(built);
      setLastRunAt(Date.now());
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      toast({ title: 'Đối chiếu thất bại', description: msg, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    run();
    const t = setInterval(run, 15000);
    return () => clearInterval(t);
  }, [run]);

  const summary = useMemo(() => {
    const c = { ok: 0, warn: 0, drift: 0, noCache: 0 };
    for (const r of rows) {
      if (r.status === 'ok') c.ok++;
      else if (r.status === 'warn') c.warn++;
      else if (r.status === 'drift') c.drift++;
      else c.noCache++;
    }
    return c;
  }, [rows]);

  const clearAllCache = useCallback(() => {
    clearSharedProductCache();
    toast({ title: 'Đã xoá cache client', description: 'Nến sẽ nạp lại từ DB ở lần render kế tiếp.' });
    run();
  }, [run]);

  const clearOne = useCallback(
    (productId: string) => {
      clearSharedProductCache(productId);
      toast({ title: 'Đã xoá cache sản phẩm này' });
      run();
    },
    [run],
  );

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center justify-between gap-2 border-b p-3">
        <div className="flex items-center gap-2 min-w-0">
          <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
          <div className="min-w-0">
            <h3 className="text-sm font-semibold truncate">Đối chiếu Client Cache ↔ DB</h3>
            <p className="text-xs text-muted-foreground truncate">
              So sánh giá client đang hiển thị vs price_history mới nhất trên server.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Badge variant="outline" className="text-green-500 border-green-500/40">OK {summary.ok}</Badge>
          {summary.warn > 0 && (
            <Badge variant="outline" className="text-amber-500 border-amber-500/40">Warn {summary.warn}</Badge>
          )}
          {summary.drift > 0 && (
            <Badge variant="outline" className="text-red-500 border-red-500/40">Drift {summary.drift}</Badge>
          )}
          <Button size="sm" variant="outline" className="h-8" onClick={run} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={clearAllCache}>
            <Trash2 className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Xoá cache</span>
          </Button>
        </div>
      </div>

      <ScrollArea className="max-h-[320px]">
        <div className="w-full overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Symbol</th>
                <th className="px-3 py-2 text-right font-medium">DB price</th>
                <th className="px-3 py-2 text-right font-medium">DB last close</th>
                <th className="px-3 py-2 text-right font-medium">Client close</th>
                <th className="px-3 py-2 text-right font-medium">Δ %</th>
                <th className="px-3 py-2 text-right font-medium">Lag (m)</th>
                <th className="px-3 py-2 text-center font-medium">Trạng thái</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const badge =
                  r.status === 'ok'
                    ? <Badge variant="outline" className="text-green-500 border-green-500/40">OK</Badge>
                    : r.status === 'warn'
                    ? <Badge variant="outline" className="text-amber-500 border-amber-500/40 gap-1"><AlertTriangle className="h-3 w-3" />Warn</Badge>
                    : r.status === 'drift'
                    ? <Badge variant="outline" className="text-red-500 border-red-500/40 gap-1"><XCircle className="h-3 w-3" />Drift</Badge>
                    : <Badge variant="outline" className="text-muted-foreground border-border">No cache</Badge>;
                return (
                  <tr key={r.productId} className="border-t border-border/50">
                    <td className="px-3 py-2 font-mono">{r.symbol}</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">
                      {r.dbPrice != null ? r.dbPrice.toFixed(4) : '—'}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">
                      {r.dbLatestCandleClose != null ? r.dbLatestCandleClose.toFixed(4) : '—'}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">
                      {r.clientCachedClose != null ? r.clientCachedClose.toFixed(4) : '—'}
                    </td>
                    <td className={`px-3 py-2 text-right font-mono tabular-nums ${
                      r.driftPct == null ? '' : r.driftPct > 0.01 ? 'text-red-500' : r.driftPct > 0.003 ? 'text-amber-500' : 'text-green-500'
                    }`}>
                      {r.driftPct == null ? '—' : (r.driftPct * 100).toFixed(3) + '%'}
                    </td>
                    <td className={`px-3 py-2 text-right font-mono tabular-nums ${
                      r.minuteLag == null ? '' : Math.abs(r.minuteLag) >= 3 ? 'text-red-500' : Math.abs(r.minuteLag) >= 1 ? 'text-amber-500' : 'text-green-500'
                    }`}>
                      {r.minuteLag == null ? '—' : r.minuteLag}
                    </td>
                    <td className="px-3 py-2 text-center">{badge}</td>
                    <td className="px-3 py-2 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs"
                        onClick={() => clearOne(r.productId)}
                        disabled={r.status === 'no-cache'}
                      >
                        Resync
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">
                    {loading ? 'Đang đối chiếu…' : 'Không có sản phẩm nào.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </ScrollArea>
      {lastRunAt && (
        <div className="border-t px-3 py-1.5 text-[11px] text-muted-foreground">
          Cập nhật lần cuối: {new Date(lastRunAt).toLocaleTimeString()} · tự động 15s/lần
        </div>
      )}
    </div>
  );
}

export default EngineDbReconcilePanel;