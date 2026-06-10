import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// ─── BTC Real Pattern (% changes from Binance 30m data) ────────────────────
const BTC_PCT: number[] = [
  0.001019, 0.001069, -0.002234, 0.000019, -0.002027, 0.000296, 0.00028, -0.00058, 0.000111, -0.001999, 0.001283,
  0.000408, 0.00011, -0.000004, -0.00082, 0.00084, -0.000939, -0.001666, 0.001654, -0.000161, 0.000438, 0.001316,
  -0.001218, -0.000393, -0.000136, -0.000023, 0.000003, -0.002566, -0.002239, -0.002347, -0.0012, 0.000433, 0.000276,
  -0.00468, -0.000324, -0.003943, 0.002401, 0.002244, -0.000681, -0.001204, 0.000257, -0.000543, 0.000677, -0.000408,
  0.0, 0.001903, -0.000025, 0.001408, 0.000653, -0.001066, 0.00107, -0.000882, -0.000238, 0.000415, 0.000322, -0.00033,
  0.000161, -0.00015, 0.000148, -0.000093, 0.000033, -0.00104, 0.000625, -0.000698, 0.000613, -0.000001, 0.000419,
  -0.003604, 0.000536, -0.003386, 0.002196, -0.000002, 0.001348, 0.000366, 0.000867, 0.00076, 0.000714, -0.00073,
  -0.000441, -0.000269, 0.000218, -0.001436, 0.000288, -0.000752, 0.000769, 0.001268, 0.000517, 0.001838, -0.000872,
  -0.002063, 0.002037, -0.000134, -0.000676, 0.000329, -0.00028, 0.00033, -0.00041, 0.000679, -0.000229, 0.000274,
  -0.009126, -0.003955, -0.000906, 0.001906, -0.001301, -0.001165, 0.004531, 0.00195, -0.000879, -0.005025, 0.001956,
  -0.005019, 0.002765, -0.001218, 0.000754, 0.003203, -0.001516, 0.000611, -0.001428, 0.001262, -0.003098, -0.000426,
  0.004275, 0.0004, -0.0004, -0.003205, 0.001805, -0.005319, 0.003005, -0.001416, 0.000885, 0.003765, -0.001784,
  0.000719, -0.001681, 0.001483, -0.001474, -0.000748, -0.001257, 0.001186, -0.03809, -0.00528, -0.00063, 0.0031,
  -0.0036, 0.00102, -0.00206, -0.00124, 0.00371, -0.00204, 0.0026, -0.00075, -0.00103, 0.00254, -0.00119, 0.00253,
  0.000446, -0.001256, 0.001208, -0.000991, -0.004198, -0.004282, 0.006121, -0.001982, 0.00124, -0.00482, 0.003581,
  -0.01271, 0.006981, -0.004218, 0.001769, 0.008978, -0.004208, 0.001437, -0.00401, 0.003528, -0.003507, -0.00154,
  -0.002592, 0.002446, -0.02189, -0.00811, 0.00381, -0.00654, 0.00361, -0.01259, 0.00878, -0.00556, 0.00327, 0.01055,
  -0.00485, 0.00174, -0.00482, 0.004031, -0.003997, -0.001763, -0.003053, 0.002883, -0.003637, 0.002802,
];

// ─── Trend phase engine ─────────────────────────────────────────────────────
// Each product gets a sequence of "phases": markup, pullback, markdown, sideways
// Phase lengths in minutes
type Phase = "markup" | "pullback" | "markdown" | "relief" | "sideways" | "spike_up" | "spike_down";

interface PhaseConfig {
  // Per-minute drift added on top of BTC pattern
  drift: number;
  // Volatility multiplier
  volMult: number;
  // Minutes min/max
  minLen: number;
  maxLen: number;
}

const PHASE_CFG: Record<Phase, PhaseConfig> = {
  markup: { drift: 0.0012, volMult: 1.4, minLen: 60, maxLen: 240 },
  pullback: { drift: -0.0008, volMult: 1.1, minLen: 30, maxLen: 90 },
  markdown: { drift: -0.0012, volMult: 1.5, minLen: 60, maxLen: 200 },
  relief: { drift: 0.0006, volMult: 1.0, minLen: 30, maxLen: 80 },
  sideways: { drift: 0.0, volMult: 0.6, minLen: 120, maxLen: 360 },
  spike_up: { drift: 0.005, volMult: 3.0, minLen: 5, maxLen: 20 },
  spike_down: { drift: -0.005, volMult: 3.0, minLen: 5, maxLen: 20 },
};

// Transition table: realistic market cycle
const TRANSITIONS: Record<Phase, Phase[]> = {
  markup: ["pullback", "pullback", "sideways", "spike_up"],
  pullback: ["markup", "markup", "sideways", "markdown"],
  markdown: ["relief", "relief", "sideways", "spike_down"],
  relief: ["markdown", "markdown", "sideways", "markup"],
  sideways: ["markup", "markdown", "spike_up", "spike_down"],
  spike_up: ["pullback", "markup"],
  spike_down: ["relief", "markdown"],
};

// Starting phase based on trend
const START_PHASES: Record<string, Phase[]> = {
  bullish: ["markup", "sideways", "pullback"],
  bearish: ["markdown", "sideways", "relief"],
  volatile: ["spike_up", "spike_down", "markup"],
  neutral: ["sideways", "markup", "markdown"],
};

// Product config
interface ProductCfg {
  basePrice: number;
  volatility: number;
  trend: string;
}

const PRODUCT_CONFIG: Record<string, ProductCfg> = {
  "AGIL/USDT": { basePrice: 601.94, volatility: 0.008, trend: "bullish" },
  "360SA/USDT": { basePrice: 40.75, volatility: 0.007, trend: "bullish" },
  "MCS/USDT": { basePrice: 14.51, volatility: 0.006, trend: "neutral" },
  "SIM/USDT": { basePrice: 9.06, volatility: 0.022, trend: "bullish" },
  "COTM/USDT": { basePrice: 9.12, volatility: 0.008, trend: "neutral" },
  "IBMS/USDT": { basePrice: 2.69, volatility: 0.014, trend: "bearish" },
  "VICS/USDT": { basePrice: 1.0, volatility: 0.035, trend: "volatile" },
  "HED/USDT": { basePrice: 6.49, volatility: 0.018, trend: "bearish" },
  "C5ISR/USDT": { basePrice: 55.2, volatility: 0.009, trend: "neutral" },
  "WIG/USDT": { basePrice: 12.5, volatility: 0.022, trend: "volatile" },
};

const BTC_BASE_VOL = 0.005;
const rand = (a: number, b: number) => a + Math.random() * (b - a);

interface GeneratedCandle {
  recorded_at: string;
  open_price: number;
  high_price: number;
  low_price: number;
  close_price: number;
  volume: number;
}

function pickFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Generate 1M candles with:
 * 1. Real BTC % pattern for micro-structure
 * 2. Phase-based trend overlay (markup/pullback/markdown cycles)
 * 3. Exact UTC minute timestamps
 */
function generateCandles(symbol: string, totalMinutes: number): GeneratedCandle[] {
  const cfg = PRODUCT_CONFIG[symbol];
  if (!cfg) return [];

  const base = cfg.basePrice;
  const volScale = cfg.volatility / BTC_BASE_VOL;

  // Price band — hard clamp to prevent runaway
  const bandPct = base < 1 ? 0.7 : base < 10 ? 0.6 : 0.5;
  const minPrice = base * (1 - bandPct);
  const maxPrice = base * (1 + bandPct);

  // Symbol hash → different start offset per product
  const symbolHash = symbol.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const btcOffset = symbolHash % BTC_PCT.length;

  // Align to exact minute boundary (UTC)
  const nowMs = Date.now();
  const nowMinute = Math.floor(nowMs / 60000) * 60000;

  // ── Build phase sequence covering totalMinutes ──────────────────────────
  const startPhases = START_PHASES[cfg.trend] || START_PHASES["neutral"];
  let currentPhase: Phase = pickFrom(startPhases);
  let phaseRemaining = Math.floor(rand(PHASE_CFG[currentPhase].minLen, PHASE_CFG[currentPhase].maxLen));

  const candles: GeneratedCandle[] = [];
  let price = base;

  for (let i = totalMinutes; i >= 1; i--) {
    // Advance phase if current one expired
    if (phaseRemaining <= 0) {
      const nextPhases = TRANSITIONS[currentPhase];
      currentPhase = pickFrom(nextPhases);
      phaseRemaining = Math.floor(rand(PHASE_CFG[currentPhase].minLen, PHASE_CFG[currentPhase].maxLen));
    }
    phaseRemaining--;

    const phase = PHASE_CFG[currentPhase];

    // BTC micro-structure % change
    const idx = (btcOffset + (totalMinutes - i)) % BTC_PCT.length;
    const btcPct = BTC_PCT[idx];

    // Combine BTC pattern with phase drift
    // Phase drift dominates for trend clarity, BTC adds realistic noise
    const combined = btcPct * volScale * phase.volMult + phase.drift;

    // Spike probability (rare shock events in pattern)
    const spike = Math.random() < 0.008 ? (2.5 + Math.random() * 2) * (Math.random() < 0.5 ? 1 : -1) : 1.0;
    const pctChange = combined * (spike !== 1.0 ? Math.abs(spike) * Math.sign(spike) : 1.0);

    const open = price;
    let close = open * (1 + pctChange);

    // Soft bounce at band edges
    if (close < minPrice) {
      close = minPrice + (minPrice - close) * 0.3;
      currentPhase = "markup"; // bounce → switch to markup
      phaseRemaining = Math.floor(rand(30, 90));
    } else if (close > maxPrice) {
      close = maxPrice - (close - maxPrice) * 0.3;
      currentPhase = "markdown"; // top → switch to markdown
      phaseRemaining = Math.floor(rand(30, 90));
    }
    if (!Number.isFinite(close) || close <= 0) close = price;

    // Wicks: larger during volatile phases
    const bodySize = Math.abs(close - open);
    const wickMult = phase.volMult * (0.4 + Math.random() * 0.8);
    const wick = bodySize * wickMult;
    const high = Math.max(open, close) + wick * Math.random();
    const low = Math.min(open, close) - wick * Math.random();

    // Volume: correlated with move size + phase activity
    const baseVol = (base * 300) / totalMinutes;
    const moveStrength = Math.abs(pctChange) / (cfg.volatility * 0.01);
    const volume = baseVol * phase.volMult * (0.4 + Math.random() * 0.8) * (1 + moveStrength * 0.3);

    // Exact UTC minute timestamp
    const minuteMs = nowMinute - i * 60000;

    candles.push({
      recorded_at: new Date(minuteMs).toISOString(),
      open_price: parseFloat(open.toFixed(6)),
      high_price: parseFloat(Math.max(high, open, close).toFixed(6)),
      low_price: parseFloat(Math.min(low, open, close).toFixed(6)),
      close_price: parseFloat(close.toFixed(6)),
      volume: parseFloat(volume.toFixed(4)),
    });

    price = close;
  }

  return candles;
}

// ─── Edge function handler ──────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

  try {
    const body = await req.json().catch(() => ({}));
    const days: number = Number(body?.days ?? 30);
    const productIds: string[] | undefined = body?.productIds;
    const totalMinutes = days * 24 * 60;

    let query = supabase.from("products").select("id, symbol, name, price").eq("status", "available");
    if (productIds?.length) query = query.in("id", productIds);
    const { data: products, error: pErr } = await query;

    if (pErr || !products?.length) {
      return new Response(JSON.stringify({ ok: false, error: pErr?.message || "No products" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const results: Record<string, { inserted: number; error?: string }> = {};

    for (const product of products) {
      const symbol = product.symbol ?? "";
      if (!PRODUCT_CONFIG[symbol]) {
        results[product.id] = { inserted: 0, error: `No config for: ${symbol}` };
        continue;
      }

      try {
        // Clear old data
        await supabase.from("price_history").delete().eq("product_id", product.id);

        // Generate with phase-based trend
        const candles = generateCandles(symbol, totalMinutes);

        // Batch upsert in chunks of 500
        let inserted = 0;
        const CHUNK = 500;
        for (let i = 0; i < candles.length; i += CHUNK) {
          const chunk = candles.slice(i, i + CHUNK).map((c) => ({
            ...c,
            product_id: product.id,
          }));
          const { error: insErr } = await supabase
            .from("price_history")
            .upsert(chunk, { onConflict: "product_id,recorded_at", ignoreDuplicates: false });
          if (insErr) throw new Error(insErr.message);
          inserted += chunk.length;
        }

        // Update product current price
        const lastCandle = candles[candles.length - 1];
        if (lastCandle) {
          await supabase.from("products").update({ price: lastCandle.close_price }).eq("id", product.id);
        }

        results[product.id] = { inserted };
      } catch (e: unknown) {
        results[product.id] = { inserted: 0, error: String(e) };
      }
    }

    return new Response(JSON.stringify({ ok: true, days, results }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  } catch (e: unknown) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
