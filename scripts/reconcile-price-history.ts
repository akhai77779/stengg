/**
 * Reconcile price_history (backfill) vs engine_state (live ticks)
 * to detect regime drift, wick anomalies, or volume divergence.
 *
 * Usage (Deno):
 *   deno run --allow-env --allow-net scripts/reconcile-price-history.ts
 *   deno run --allow-env --allow-net scripts/reconcile-price-history.ts --hours 6 --product agil
 *   deno run --allow-env --allow-net scripts/reconcile-price-history.ts --granularity 1 --csv /mnt/documents/divergences.csv
 *
 * Required env:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * What it checks per product:
 *   1. Candle count vs expected (1 per minute in the window)
 *   2. Missing minute buckets (gaps) — every missing minute is listed
 *   3. OHLC sanity per candle (high/low must wrap open/close)
 *   4. Body / wick / volume stats (median, p95, max)
 *   5. Anchor drift: % distance of last close vs configured basePrice
 *   6. Live regime (engine_state.extra.regime) vs realised drift in last 30 candles
 *   7. Per-bucket divergence (granularity in minutes, default 5):
 *      compares median body% / volume of LIVE bucket (last hour) vs
 *      ROLLING BACKFILL baseline. Flags |ratio| > 3x.
 *   8. Per-candle outliers: body% > 8x rolling median or wick > 10x body or
 *      volume > 10x rolling median → listed timestamp by timestamp.
 *   9. Optional CSV export of every divergent timestamp (--csv <path>).
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
const GRANULARITY = Math.max(1, Number(args.get("granularity") ?? 5)); // minutes per bucket
const CSV_PATH = args.get("csv"); // optional
const VERBOSE = args.get("verbose") === "true" || args.has("verbose");

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
  // CSV rows: product_symbol, recorded_at, kind, detail, open, high, low, close, volume
  const csvRows: string[][] = [];
  const liveCutoffMs = nowMs - 60 * 60 * 1000; // last hour = live ticks

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

    // 1. Gaps (collect every missing minute timestamp)
    const buckets = new Set(
      data.map((r) => Math.floor(new Date(r.recorded_at).getTime() / 60000)),
    );
    const firstB = Math.floor(new Date(data[0].recorded_at).getTime() / 60000);
    const lastB = Math.floor(new Date(data[data.length - 1].recorded_at).getTime() / 60000);
    const gapMinutes: number[] = [];
    for (let b = firstB; b <= lastB; b++) if (!buckets.has(b)) gapMinutes.push(b);
    const gaps = gapMinutes.length;
    for (const b of gapMinutes) {
      const ts = new Date(b * 60000).toISOString();
      csvRows.push([p.symbol, ts, "gap", "missing minute bucket", "", "", "", "", ""]);
    }

    // 2. OHLC sanity + per-candle outlier detection (rolling median over 30 prior candles)
    let badOHLC = 0;
    const bodies: number[] = [];
    const wicks: number[] = [];
    const vols: number[] = [];
    const bodyPctArr = data.map((r) => Math.abs(r.close_price - r.open_price) / r.open_price);
    const volArr = data.map((r) => r.volume);
    const rollMed = (arr: number[], end: number, win = 30) => {
      const slice = arr.slice(Math.max(0, end - win), end).slice().sort((a, b) => a - b);
      return slice.length ? slice[Math.floor(slice.length / 2)] : 0;
    };
    let outlierCount = 0;
    for (let i = 0; i < data.length; i++) {
      const r = data[i];
      const hi = Math.max(r.open_price, r.close_price);
      const lo = Math.min(r.open_price, r.close_price);
      if (r.high_price + 1e-9 < hi || r.low_price - 1e-9 > lo) {
        badOHLC++;
        csvRows.push([
          p.symbol, r.recorded_at, "bad_ohlc", "high<max(o,c) or low>min(o,c)",
          String(r.open_price), String(r.high_price), String(r.low_price), String(r.close_price), String(r.volume),
        ]);
      }
      bodies.push(Math.abs(r.close_price - r.open_price) / r.open_price);
      wicks.push((r.high_price - r.low_price) / r.open_price);
      vols.push(r.volume);

      if (i >= 30) {
        const bodyPct = bodyPctArr[i];
        const wickPct = (r.high_price - r.low_price) / r.open_price;
        const medB = rollMed(bodyPctArr, i);
        const medV = rollMed(volArr, i);
        const bodyRatio = medB > 0 ? bodyPct / medB : 0;
        const volRatio = medV > 0 ? r.volume / medV : 0;
        const wickToBody = bodyPct > 0 ? wickPct / bodyPct : 0;
        const reasons: string[] = [];
        if (bodyRatio > 8) reasons.push(`body x${bodyRatio.toFixed(1)}`);
        if (volRatio > 10) reasons.push(`vol x${volRatio.toFixed(1)}`);
        if (wickToBody > 10 && bodyPct > 0.0005) reasons.push(`wick/body x${wickToBody.toFixed(1)}`);
        if (reasons.length) {
          outlierCount++;
          csvRows.push([
            p.symbol, r.recorded_at, "outlier", reasons.join("; "),
            String(r.open_price), String(r.high_price), String(r.low_price), String(r.close_price), String(r.volume),
          ]);
        }
      }
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

    // 5. Per-bucket divergence (granularity = N minutes).
    //    Bucket each candle into [start, start+N). For each bucket compute median
    //    body% & volume. Backfill baseline = median across all backfill buckets
    //    (recorded_at < nowMs - 1h). Live buckets = last hour. Any bucket whose
    //    body or vol diverges >3x from baseline is listed.
    const bucketSize = GRANULARITY * 60000;
    type Bucket = { startMs: number; rows: Row[]; live: boolean };
    const bMap = new Map<number, Bucket>();
    for (const r of data) {
      const t = new Date(r.recorded_at).getTime();
      const start = Math.floor(t / bucketSize) * bucketSize;
      let b = bMap.get(start);
      if (!b) { b = { startMs: start, rows: [], live: start >= liveCutoffMs }; bMap.set(start, b); }
      b.rows.push(r);
    }
    const allBuckets = [...bMap.values()].sort((a, b) => a.startMs - b.startMs);
    const bucketBody = (b: Bucket) =>
      quantile(b.rows.map((r) => Math.abs(r.close_price - r.open_price) / r.open_price).sort((a, b) => a - b), 0.5);
    const bucketVol = (b: Bucket) =>
      quantile(b.rows.map((r) => r.volume).sort((a, b) => a - b), 0.5);
    const backBuckets = allBuckets.filter((b) => !b.live);
    const baseBody = backBuckets.length
      ? quantile(backBuckets.map(bucketBody).sort((a, b) => a - b), 0.5) : 0;
    const baseVol = backBuckets.length
      ? quantile(backBuckets.map(bucketVol).sort((a, b) => a - b), 0.5) : 0;
    const divergentBuckets: { ts: string; bRatio: number; vRatio: number; live: boolean }[] = [];
    for (const b of allBuckets) {
      const bb = bucketBody(b);
      const bv = bucketVol(b);
      const br = baseBody > 0 ? bb / baseBody : 1;
      const vr = baseVol > 0 ? bv / baseVol : 1;
      if ((br > 3 || (br > 0 && br < 0.33)) || (vr > 3 || (vr > 0 && vr < 0.33))) {
        const ts = new Date(b.startMs).toISOString();
        divergentBuckets.push({ ts, bRatio: br, vRatio: vr, live: b.live });
        csvRows.push([
          p.symbol, ts, b.live ? "bucket_diverge_live" : "bucket_diverge_back",
          `body x${br.toFixed(2)} vol x${vr.toFixed(2)} (granularity=${GRANULARITY}m)`,
          "", "", "", "", "",
        ]);
      }
    }

    const okCount = data.length >= expectedCount * 0.9;
    const head =
      (okCount ? color("✓", "green") : color("✗", "red")) +
      ` ${p.symbol.padEnd(12)}` +
      ` candles=${String(data.length).padStart(4)}/${expectedCount}` +
      ` gaps=${String(gaps).padStart(3)}` +
      ` badOHLC=${badOHLC}` +
      ` outliers=${outlierCount}` +
      ` divBkt=${divergentBuckets.length}` +
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
    if (divergentBuckets.length) {
      const show = VERBOSE ? divergentBuckets : divergentBuckets.slice(0, 5);
      for (const d of show) {
        console.log(
          "   " +
            color(
              `⚠ ${d.live ? "LIVE " : "BACK "}${d.ts}  body x${d.bRatio.toFixed(2)}  vol x${d.vRatio.toFixed(2)}`,
              "yellow",
            ),
        );
      }
      if (!VERBOSE && divergentBuckets.length > 5) {
        console.log(color(`   … +${divergentBuckets.length - 5} more (use --verbose or --csv)`, "dim"));
      }
      issues.push(`${p.symbol}: ${divergentBuckets.length} divergent ${GRANULARITY}m buckets`);
    }
    if (outlierCount > 0) issues.push(`${p.symbol}: ${outlierCount} candle outliers`);
    if (gaps > expectedCount * 0.05) issues.push(`${p.symbol}: ${gaps} minute gaps`);
    if (badOHLC > 0) issues.push(`${p.symbol}: ${badOHLC} invalid OHLC rows`);
    if (Math.abs(drift) > 0.5) issues.push(`${p.symbol}: anchor drift ${pct(drift)}`);
  }

  console.log();
  if (CSV_PATH) {
    const header = ["product", "recorded_at", "kind", "detail", "open", "high", "low", "close", "volume"];
    const esc = (s: string) => /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    const body = [header, ...csvRows].map((r) => r.map(esc).join(",")).join("\n");
    await Deno.writeTextFile(CSV_PATH, body + "\n");
    console.log(color(`Wrote ${csvRows.length} divergent rows → ${CSV_PATH}`, "green"));
  }
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