import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

// ─────────────────────────────────────────────────────────────────────
// Regime-based candle generator (mirror of market-engine-tick).
// Kept inline because edge functions cannot share modules across folders.
// ─────────────────────────────────────────────────────────────────────

type Regime = 'sideways' | 'trending_up' | 'trending_down' | 'volatile';

interface RegimeState {
  regime: Regime;
  ticksInRegime: number;
  momentum: number;
  vol: number;
  anchor?: number;
}

const REGIME_PARAMS: Record<Regime, {
  volMin: number; volMax: number;
  driftMin: number; driftMax: number;
  wickMultMin: number; wickMultMax: number;
  volumeMult: number;
}> = {
  sideways:      { volMin: 0.001, volMax: 0.003, driftMin: -0.0002, driftMax: 0.0002, wickMultMin: 0.3, wickMultMax: 1.2, volumeMult: 0.5 },
  trending_up:   { volMin: 0.003, volMax: 0.006, driftMin: 0.0010,  driftMax: 0.0020, wickMultMin: 0.4, wickMultMax: 2.0, volumeMult: 1.2 },
  trending_down: { volMin: 0.003, volMax: 0.006, driftMin: -0.0020, driftMax: -0.0010, wickMultMin: 0.4, wickMultMax: 2.0, volumeMult: 1.2 },
  volatile:      { volMin: 0.010, volMax: 0.020, driftMin: -0.0010, driftMax: 0.0010, wickMultMin: 1.0, wickMultMax: 4.0, volumeMult: 2.5 },
};

const rand = (a: number, b: number) => a + Math.random() * (b - a);
function gauss() {
  const u = Math.max(1e-9, Math.random());
  const v = Math.max(1e-9, Math.random());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function pickRegime(prev?: Regime): Regime {
  const w: Record<Regime, number> = { sideways: 0.40, trending_up: 0.25, trending_down: 0.25, volatile: 0.10 };
  if (prev) w[prev] *= 0.3;
  const total = Object.values(w).reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (const [k, val] of Object.entries(w)) { r -= val; if (r <= 0) return k as Regime; }
  return 'sideways';
}

function maybeTransition(s: RegimeState, anchorPrice: number): RegimeState {
  const p = 0.02 + Math.min(s.ticksInRegime * 0.001, 0.13);
  if (Math.random() < p) {
    const next = pickRegime(s.regime);
    return {
      regime: next, ticksInRegime: 0, momentum: 0,
      vol: rand(REGIME_PARAMS[next].volMin, REGIME_PARAMS[next].volMax),
      anchor: next === 'sideways' ? anchorPrice : undefined,
    };
  }
  return s;
}

function generateCandle(prevClose: number, s: RegimeState) {
  const params = REGIME_PARAMS[s.regime];
  let drift = rand(params.driftMin, params.driftMax);
  if (s.regime === 'sideways' && s.anchor) {
    drift -= ((prevClose - s.anchor) / s.anchor) * 0.3;
  }
  const momentumDecay = s.regime === 'sideways' ? 0.4 : s.regime === 'volatile' ? 0.5 : 0.85;
  const newMomentum = s.momentum * momentumDecay + drift * 0.5;
  const shock = gauss() * s.vol;
  const totalReturn = newMomentum + shock;

  const open = prevClose;
  let close = Math.max(0.0001, open * (1 + totalReturn));
  if (s.regime === 'sideways' && s.anchor) {
    const up = s.anchor * 1.005, lo = s.anchor * 0.995;
    if (close > up) close = up - Math.random() * (up - s.anchor) * 0.3;
    if (close < lo) close = lo + Math.random() * (s.anchor - lo) * 0.3;
  }

  const bodyPct = Math.abs(close - open) / Math.max(open, 1e-9);
  const baseWick = Math.max(bodyPct, s.vol * 0.5);
  const high = Math.max(open, close) * (1 + baseWick * rand(params.wickMultMin, params.wickMultMax) * 0.5);
  const low  = Math.min(open, close) * (1 - baseWick * rand(params.wickMultMin, params.wickMultMax) * 0.5);

  const moveRatio = bodyPct / 0.004;
  const baseV = 2000 * params.volumeMult;
  const volume = Math.round(baseV * 0.4 + baseV * Math.max(moveRatio, 0.3) * (0.5 + Math.random() * 1.5) + Math.random() * 800);

  const targetVol = rand(params.volMin, params.volMax);
  const nextVol = s.vol * 0.9 + targetVol * 0.1;

  return {
    candle: { open, high, low, close, volume },
    nextState: {
      regime: s.regime,
      ticksInRegime: s.ticksInRegime + 1,
      momentum: Math.max(-0.05, Math.min(0.05, newMomentum)),
      vol: nextVol,
      anchor: s.anchor,
    } as RegimeState,
  };
}

function initState(anchor: number): RegimeState {
  const r = pickRegime();
  return {
    regime: r, ticksInRegime: 0, momentum: 0,
    vol: rand(REGIME_PARAMS[r].volMin, REGIME_PARAMS[r].volMax),
    anchor: r === 'sideways' ? anchor : undefined,
  };
}

// ─────────────────────────────────────────────────────────────────────
// Handler
// ─────────────────────────────────────────────────────────────────────

const DAYS = 30;
const MINUTES_PER_DAY = 24 * 60;
const TOTAL_CANDLES = DAYS * MINUTES_PER_DAY; // 43,200
const CHUNK = 1000; // upsert batch size

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(url, key, { auth: { persistSession: false } });

    let body: { productIds?: string[]; days?: number } = {};
    try { body = await req.json(); } catch { /* allow empty body = all products */ }

    const days = Math.max(1, Math.min(Number(body.days ?? DAYS), 90));
    const totalCandles = days * MINUTES_PER_DAY;

    // Resolve product list
    let prodQuery = supabase.from('products').select('id, price').eq('status', 'available');
    if (Array.isArray(body.productIds) && body.productIds.length > 0) {
      prodQuery = supabase.from('products').select('id, price').in('id', body.productIds);
    }
    const { data: products, error: prodErr } = await prodQuery;
    if (prodErr) throw prodErr;
    if (!products || products.length === 0) {
      return new Response(JSON.stringify({ ok: true, message: 'No products' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const nowMs = Date.now();
    const startMinute = Math.floor((nowMs - days * 86400_000) / 60000) * 60000;

    const summary: Array<{ product_id: string; rows: number; finalPrice: number }> = [];

    for (const p of products) {
      const currentPrice = Number((p as any).price) > 0 ? Number((p as any).price) : 100;

      // Walk FORWARD from start, but we want to end at ~ currentPrice.
      // Strategy: walk forward from a synthetic starting price chosen so the
      // random walk has a mean ending close to currentPrice. Simplest: start
      // at currentPrice and let regime drift wander naturally; then rescale
      // the final series so the LAST close == currentPrice.
      const startPrice = currentPrice;
      let price = startPrice;
      let state = initState(price);

      const rows: any[] = [];
      for (let i = 0; i < totalCandles; i++) {
        state = maybeTransition(state, price);
        const { candle, nextState } = generateCandle(price, state);
        state = nextState;
        const recordedAt = new Date(startMinute + i * 60000).toISOString();
        rows.push({
          product_id: p.id,
          recorded_at: recordedAt,
          open_price: candle.open,
          high_price: candle.high,
          low_price: candle.low,
          close_price: candle.close,
          volume: candle.volume,
        });
        price = candle.close;
      }

      // Rescale so the final close matches currentPrice (keeps live continuity).
      const finalClose = rows[rows.length - 1].close_price;
      const scale = currentPrice / finalClose;
      for (const r of rows) {
        r.open_price *= scale;
        r.high_price *= scale;
        r.low_price  *= scale;
        r.close_price *= scale;
      }

      // Upsert in chunks
      let written = 0;
      for (let i = 0; i < rows.length; i += CHUNK) {
        const slice = rows.slice(i, i + CHUNK);
        const { error } = await supabase
          .from('price_history')
          .upsert(slice, { onConflict: 'product_id,recorded_at', ignoreDuplicates: false });
        if (error) {
          console.warn(`backfill chunk ${i} for ${p.id}:`, error.message);
        } else {
          written += slice.length;
        }
      }

      // Seed engine_state so live ticks continue with a fresh regime + correct price
      const finalPrice = rows[rows.length - 1].close_price;
      const seedRegime = initState(finalPrice);
      await supabase.from('engine_state').upsert({
        product_id: p.id,
        last_price: finalPrice,
        last_recorded_at: new Date().toISOString(),
        extra: {
          regime: seedRegime.regime,
          ticksInRegime: 0,
          momentum: 0,
          vol: seedRegime.vol,
          anchor: seedRegime.anchor ?? null,
        },
        updated_at: new Date().toISOString(),
      }, { onConflict: 'product_id' });

      summary.push({ product_id: p.id, rows: written, finalPrice });
    }

    return new Response(JSON.stringify({ ok: true, days, products: summary.length, summary }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('backfill-price-history error', e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});