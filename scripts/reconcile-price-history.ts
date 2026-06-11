/**
 * Reconcile price_history (backfill) vs engine_state (live ticks)
 * to detect regime drift, wick anomalies, or volume divergence.
 *
 * Usage (Deno):
 *   deno run --allow-env --allow-net scripts/reconcile-price-history.ts
 *   deno run --allow-env --allow-net scripts/reconcile-price-history.ts --hours 6 --product agil
 *
 * Required env:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * What it checks per product:
 *   1. Candle count vs expected (1 per minute in the window)
 *   2. Missing minute buckets (gaps)
 *   3. OHLC sanity: high >= max(open,close), low <= min(open,close)
 *   4. Body / wick / volume stats (median, p95, max)
 *   5. Anchor drift: % distance of last close vs configured basePrice
 *   6. Live regime (engine_state.extra.regime) vs realised drift in last 30 candles
 *      → flags if regime says "trending_up" but realised drift < 0, etc.
 *   7. Compares median body% & volume of LAST hour (live ticks) vs PRIOR window (backfill)
 *      → flags >3x divergence as suspicious.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  Deno.exit(1);
}

const args = new Map<string, string>();
for (let i = 0; i < Deno.args.length; i++) {
  const a = Deno.args[i];
  if (a.startsWith("--")) args.set(a.slice(2), Deno.args[i + 1] ?? "true");
}
const HOURS = Number(args.get("hours") ?? 6);
const PRODUCT_FILTER = args.get("product");

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

type Row = {
  recorded_at: string;
  open_price: number;
  high_price: number;
  low_price: number;
  close_price: number;
  volume: number;
};

function pct(n: number) {
  return (n * 100).toFixed(3) + "%";
}
function quantile(sorted: number[], q: number) {
  if (!sorted.length) return 0;
  const i = Math.min(sorted.length - 1, Math.floor(sorted.length * q));
  return sorted[i];
}
function fmt(n: number, d = 4) {
  return Number.isFinite(n) ? n.toFixed(d) : "—";
}
function color(s: string, c: "red" | "yellow" | "green" | "dim") {
  const codes = { red: 31, yellow: 33, green: 32, dim: 90 } as const;
  return `\x1b[${codes[c]}m${s}\x1b[0m`;
}

async function main() {
  let q = supabase
    .from("products")
    .select("id, symbol, name, price")
    .eq("status", "available");
  if (PRODUCT_FILTER) q = q.eq("id", PRODUCT_FILTER);
  const { data: products, error } = await q;
  if (error) throw error;
  if (!products?.length) {
    console.log("No products found.");
    return;
  }

  const nowMs = Date.now();
  const sinceMs = nowMs - HOURS * 3600 * 1000;
  const expectedCount = HOURS * 60;

  console.log(
    `\n${color("RECONCILE", "green")}  window=${HOURS}h  expected≈${expectedCount} candles/product\n`,
  );

  const issues: string[] = [];

  for (const p of products) {
    const [{ data: rows }, { data: state }] = await Promise.all([
      supabase
        .from("price_history")
        .select("recorded_at, open_price, high_price, low_price, close_price, volume")
        .eq("product_id", p.id)
        .gte("recorded_at", new Date(sinceMs).toISOString())
        .order("recorded_at", { ascending: true }),
      supabase
        .from("engine_state")
        .select("last_price, last_recorded_at, extra")
        .eq("product_id", p.id)
        .maybeSingle(),
    ]);

    const data = (rows ?? []) as Row[];
    if (!data.length) {
      console.log(color(`✗ ${p.symbol}  no candles in window`, "red"));
      issues.push(`${p.symbol}: no candles`);
      continue;
    }

    // 1. Gaps
    const buckets = new Set(
      data.map((r) => Math.floor(new Date(r.recorded_at).getTime() / 60000)),
    );
    const firstB = Math.floor(new Date(data[0].recorded_at).getTime() / 60000);
    const lastB = Math.floor(new Date(data[data.length - 1].recorded_at).getTime() / 60000);
    let gaps = 0;
    for (let b = firstB; b <= lastB; b++) if (!buckets.has(b)) gaps++;

    // 2. OHLC sanity
    let badOHLC = 0;
    const bodies: number[] = [];
    const wicks: number[] = [];
    const vols: number[] = [];
    for (const r of data) {
      const hi = Math.max(r.open_price, r.close_price);
      const lo = Math.min(r.open_price, r.close_price);
      if (r.high_price + 1e-9 < hi || r.low_price - 1e-9 > lo) badOHLC++;
      bodies.push(Math.abs(r.close_price - r.open_price) / r.open_price);
      wicks.push((r.high_price - r.low_price) / r.open_price);
      vols.push(r.volume);
    }
    bodies.sort((a, b) => a - b);
    wicks.sort((a, b) => a - b);
    vols.sort((a, b) => a - b);

    // 3. Anchor drift
    const last = data[data.length - 1];
    const anchor = Number(state?.extra && (state.extra as any).anchor) || p.price || 1;
    const drift = (last.close_price - anchor) / anchor;

    // 4. Regime vs realised
    const tail = data.slice(-30);
    const realised = tail.length > 1
      ? (tail[tail.length - 1].close_price - tail[0].close_price) / tail[0].close_price
      : 0;
    const regime = (state?.extra as any)?.regime ?? "?";
    let regimeFlag = "";
    if (regime === "trending_up" && realised < -0.003) regimeFlag = "⚠ trending_up but realised ↓";
    else if (regime === "trending_down" && realised > 0.003) regimeFlag = "⚠ trending_down but realised ↑";
    else if (regime === "sideways" && Math.abs(realised) > 0.02) regimeFlag = "⚠ sideways but realised >2%";

    // 5. Live vs backfill divergence (last 60min vs prior)
    const splitTs = nowMs - 60 * 60 * 1000;
    const live = data.filter((r) => new Date(r.recorded_at).getTime() >= splitTs);
    const back = data.filter((r) => new Date(r.recorded_at).getTime() < splitTs);
    const medBody = (arr: Row[]) => {
      const xs = arr.map((r) => Math.abs(r.close_price - r.open_price) / r.open_price).sort((a, b) => a - b);
      return quantile(xs, 0.5);
    };
    const medVol = (arr: Row[]) => {
      const xs = arr.map((r) => r.volume).sort((a, b) => a - b);
      return quantile(xs, 0.5);
    };
    const liveBody = medBody(live);
    const backBody = medBody(back);
    const liveVol = medVol(live);
    const backVol = medVol(back);
    const bodyRatio = backBody > 0 ? liveBody / backBody : 1;
    const volRatio = backVol > 0 ? liveVol / backVol : 1;
    const divergeFlag: string[] = [];
    if (back.length > 20 && live.length > 5) {
      if (bodyRatio > 3 || bodyRatio < 0.33) divergeFlag.push(`body x${bodyRatio.toFixed(2)}`);
      if (volRatio > 3 || volRatio < 0.33) divergeFlag.push(`vol x${volRatio.toFixed(2)}`);
    }

    const okCount = data.length >= expectedCount * 0.9;
    const head =
      (okCount ? color("✓", "green") : color("✗", "red")) +
      ` ${p.symbol.padEnd(12)}` +
      ` candles=${String(data.length).padStart(4)}/${expectedCount}` +
      ` gaps=${String(gaps).padStart(3)}` +
      ` badOHLC=${badOHLC}` +
      ` regime=${regime.padEnd(13)}` +
      ` anchor=${fmt(anchor)} last=${fmt(last.close_price)} drift=${pct(drift)}`;
    console.log(head);
    console.log(
      color(
        `   body  p50=${pct(quantile(bodies, 0.5))} p95=${pct(quantile(bodies, 0.95))} max=${pct(bodies[bodies.length - 1])}` +
          `   wick p50=${pct(quantile(wicks, 0.5))} p95=${pct(quantile(wicks, 0.95))}` +
          `   vol p50=${fmt(quantile(vols, 0.5), 0)} p95=${fmt(quantile(vols, 0.95), 0)}`,
        "dim",
      ),
    );
    if (regimeFlag) {
      console.log("   " + color(regimeFlag + ` (Δ=${pct(realised)})`, "yellow"));
      issues.push(`${p.symbol}: ${regimeFlag}`);
    }
    if (divergeFlag.length) {
      console.log("   " + color(`⚠ live vs backfill divergence: ${divergeFlag.join(", ")}`, "yellow"));
      issues.push(`${p.symbol}: ${divergeFlag.join(", ")}`);
    }
    if (gaps > expectedCount * 0.05) issues.push(`${p.symbol}: ${gaps} minute gaps`);
    if (badOHLC > 0) issues.push(`${p.symbol}: ${badOHLC} invalid OHLC rows`);
    if (Math.abs(drift) > 0.5) issues.push(`${p.symbol}: anchor drift ${pct(drift)}`);
  }

  console.log();
  if (issues.length === 0) {
    console.log(color("All products OK.", "green"));
  } else {
    console.log(color(`Found ${issues.length} issue(s):`, "red"));
    for (const i of issues) console.log("  - " + i);
    Deno.exit(2);
  }
}

main().catch((e) => {
  console.error(e);
  Deno.exit(1);
});