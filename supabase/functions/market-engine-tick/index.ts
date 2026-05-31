import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

interface ProductRow {
  id: string;
  price: number | null;
  status: string;
  symbol: string | null;
}

interface EngineStateRow {
  product_id: string;
  last_price: number;
  last_recorded_at: string;
  extra: Record<string, unknown>;
}

interface ShockEventRow {
  id: string;
  product_id: string;
  shock_type: 'pump' | 'dump';
  magnitude: number;
  scheduled_at: string;
  applied: boolean;
}

// ─────────────────────────────────────────────────────────────────────
// Realistic market-regime candle generation.
// Exported (via re-import in backfill) so both live ticks and backfill
// share the EXACT SAME logic.
// ─────────────────────────────────────────────────────────────────────

export type Regime = 'sideways' | 'trending_up' | 'trending_down' | 'volatile';

export interface RegimeState {
  regime: Regime;
  ticksInRegime: number;
  momentum: number;
  vol: number;
  anchor?: number; // mean for sideways
}

// Anchor prices per symbol — keeps long-running random walks from diverging.
// Must mirror src/data/products.ts basePrice.
export const BASE_PRICES: Record<string, number> = {
  'AGIL/USDT': 601.94,
  '360SA/USDT': 40.75,
  'MCS/USDT': 14.51,
  'SIM/USDT': 9.06,
  'COTM/USDT': 9.12,
  'IBMS/USDT': 2.69,
  'VICS/USDT': 0.01,
  'HED/USDT': 6.49,
  'C5ISR/USDT': 1.00,
  'WIG/USDT': 0.23,
};
export function getBasePrice(symbol: string | null | undefined, fallback: number): number {
  if (symbol && BASE_PRICES[symbol]) return BASE_PRICES[symbol];
  return fallback > 0 ? fallback : 1;
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

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

// Box-Muller standard normal
function gauss(): number {
  const u = Math.max(1e-9, Math.random());
  const v = Math.max(1e-9, Math.random());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function pickRegime(prev?: Regime): Regime {
  // Weighted distribution: most time spent in sideways/trending, rarely volatile.
  const weights: Record<Regime, number> = {
    sideways: 0.40,
    trending_up: 0.25,
    trending_down: 0.25,
    volatile: 0.10,
  };
  // Avoid immediately re-picking the same regime
  if (prev) weights[prev] *= 0.3;
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (const [k, w] of Object.entries(weights)) {
    r -= w;
    if (r <= 0) return k as Regime;
  }
  return 'sideways';
}

/**
 * Transition probability grows with ticksInRegime.
 * Base ~2%, +0.1% per tick, capped at ~15%.
 */
function maybeTransition(state: RegimeState, anchorPrice: number): RegimeState {
  const base = 0.02;
  const growth = Math.min(state.ticksInRegime * 0.001, 0.13);
  const p = base + growth;
  if (Math.random() < p) {
    const next = pickRegime(state.regime);
    return {
      regime: next,
      ticksInRegime: 0,
      momentum: 0,
      vol: rand(REGIME_PARAMS[next].volMin, REGIME_PARAMS[next].volMax),
      anchor: next === 'sideways' ? anchorPrice : undefined,
    };
  }
  return state;
}

export interface GeneratedCandle {
  open: number; high: number; low: number; close: number; volume: number;
}

export function generateRegimeCandle(
  prevClose: number,
  state: RegimeState,
): { candle: GeneratedCandle; nextState: RegimeState } {
  const params = REGIME_PARAMS[state.regime];

  // Drift in the regime's direction (per-tick).
  let drift = rand(params.driftMin, params.driftMax);
  // Mean-reversion toward anchor for ALL regimes (strong for sideways, mild for others)
  // so long random walks don't diverge exponentially.
  if (state.anchor && state.anchor > 0) {
    const dev = (prevClose - state.anchor) / state.anchor;
    const pull = state.regime === 'sideways' ? 0.30
               : state.regime === 'volatile' ? 0.08
               : 0.05;
    drift -= dev * pull;
  }

  // Momentum accumulates for trends, decays fast for sideways/volatile
  const momentumDecay = state.regime === 'sideways' ? 0.4
                      : state.regime === 'volatile' ? 0.5
                      : 0.85;
  const newMomentum = state.momentum * momentumDecay + drift * 0.5;

  // Shock from current vol
  const shock = gauss() * state.vol;
  const totalReturn = newMomentum + shock;

  const open = prevClose;
  let close = Math.max(0.0001, open * (1 + totalReturn));

  // Sideways clamp ±0.5% from anchor
  if (state.regime === 'sideways' && state.anchor) {
    const upper = state.anchor * 1.005;
    const lower = state.anchor * 0.995;
    if (close > upper) close = upper - Math.random() * (upper - state.anchor) * 0.3;
    if (close < lower) close = lower + Math.random() * (state.anchor - lower) * 0.3;
  }

  // Hard band around anchor for all regimes — prevents long-term drift to 0 or infinity.
  if (state.anchor && state.anchor > 0) {
    const hardMax = state.anchor * 2.0;
    const hardMin = state.anchor * 0.5;
    if (close > hardMax) close = hardMax - Math.random() * (hardMax - state.anchor) * 0.2;
    if (close < hardMin) close = hardMin + Math.random() * (state.anchor - hardMin) * 0.2;
  }

  // Wick: based on regime, with intrabar pressure (gauss-driven)
  const bodyPct = Math.abs(close - open) / Math.max(open, 1e-9);
  const baseWick = Math.max(bodyPct, state.vol * 0.5);
  const wickHi = baseWick * rand(params.wickMultMin, params.wickMultMax) * 0.5;
  const wickLo = baseWick * rand(params.wickMultMin, params.wickMultMax) * 0.5;
  const high = Math.max(open, close) * (1 + wickHi);
  const low  = Math.min(open, close) * (1 - wickLo);

  // Volume: scaled by regime and body magnitude
  const moveRatio = bodyPct / 0.004;
  const baseVol = 2000 * params.volumeMult;
  const spike = baseVol * Math.max(moveRatio, 0.3) * (0.5 + Math.random() * 1.5);
  const volume = Math.round(baseVol * 0.4 + spike + Math.random() * 800);

  // Volatility evolves: mean-revert toward regime band
  const targetVol = rand(params.volMin, params.volMax);
  const nextVol = state.vol * 0.9 + targetVol * 0.1;

  return {
    candle: { open, high, low, close, volume },
    nextState: {
      regime: state.regime,
      ticksInRegime: state.ticksInRegime + 1,
      momentum: Math.max(-0.05, Math.min(0.05, newMomentum)),
      vol: nextVol,
      anchor: state.anchor,
    },
  };
}

export function initialRegimeState(anchorPrice: number, regime?: Regime): RegimeState {
  const r = regime ?? pickRegime();
  return {
    regime: r,
    ticksInRegime: 0,
    momentum: 0,
    vol: rand(REGIME_PARAMS[r].volMin, REGIME_PARAMS[r].volMax),
    // Anchor every regime so mean-reversion works across long sessions.
    anchor: anchorPrice,
  };
}

export function loadRegimeState(extra: Record<string, unknown> | undefined, anchor: number): RegimeState {
  const e = (extra ?? {}) as any;
  const validRegimes: Regime[] = ['sideways', 'trending_up', 'trending_down', 'volatile'];
  if (!validRegimes.includes(e.regime)) return initialRegimeState(anchor);
  return {
    regime: e.regime,
    ticksInRegime: Number(e.ticksInRegime ?? 0),
    momentum: Number(e.momentum ?? 0),
    vol: Number(e.vol ?? REGIME_PARAMS[e.regime as Regime].volMin),
    // Always re-anchor to the canonical basePrice so legacy state rows without an anchor still mean-revert.
    anchor,
  };
}

export { maybeTransition };

function applyShock(price: number, ev: ShockEventRow): number {
  const pct = Math.abs(ev.magnitude) / 100;
  const dir = ev.shock_type === 'pump' ? 1 : -1;
  return Math.max(0.0001, price * (1 + dir * pct));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const url = Deno.env.get('SUPABASE_URL')!;
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  try {
    // 1. Load active products
    const { data: products, error: prodErr } = await supabase
      .from('products')
      .select('id, price, status, symbol')
      .eq('status', 'available');
    if (prodErr) throw prodErr;
    const list: ProductRow[] = products ?? [];
    if (list.length === 0) {
      return new Response(JSON.stringify({ ok: true, ticked: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const ids = list.map((p) => p.id);

    // 2. Load engine_state
    const { data: states } = await supabase
      .from('engine_state')
      .select('product_id, last_price, last_recorded_at, extra')
      .in('product_id', ids);
    const stateMap = new Map<string, EngineStateRow>();
    (states ?? []).forEach((s: any) => stateMap.set(s.product_id, s));

    // 3. Load pending shocks scheduled <= now
    const nowIso = new Date().toISOString();
    const { data: shocks } = await supabase
      .from('shock_events')
      .select('id, product_id, shock_type, magnitude, scheduled_at, applied')
      .eq('applied', false)
      .lte('scheduled_at', nowIso);
    const shocksByProduct = new Map<string, ShockEventRow[]>();
    (shocks ?? []).forEach((s: any) => {
      const arr = shocksByProduct.get(s.product_id) ?? [];
      arr.push(s);
      shocksByProduct.set(s.product_id, arr);
    });

    const appliedShockIds: string[] = [];
    const historyRows: any[] = [];
    const stateUpserts: any[] = [];
    const productUpdates: { id: string; price: number }[] = [];

    const tickTime = new Date();
    const minuteBucket = new Date(Math.floor(tickTime.getTime() / 60000) * 60000);

    for (const p of list) {
      const state = stateMap.get(p.id);
      const anchorPrice = getBasePrice(p.symbol, p.price ?? 100);
      let basePrice = state?.last_price ?? p.price ?? anchorPrice;
      if (!Number.isFinite(basePrice) || basePrice <= 0) basePrice = anchorPrice;
      // If legacy data drifted way out of band, snap back into [anchor*0.5, anchor*2]
      if (basePrice > anchorPrice * 2) basePrice = anchorPrice * 1.5;
      if (basePrice < anchorPrice * 0.5) basePrice = anchorPrice * 0.7;

      // Apply pending shocks first
      const productShocks = shocksByProduct.get(p.id) ?? [];
      for (const sh of productShocks) {
        basePrice = applyShock(basePrice, sh);
        appliedShockIds.push(sh.id);
      }

      // Load regime state (anchored to canonical basePrice), possibly transition, then generate a candle
      let regimeState = loadRegimeState(state?.extra, anchorPrice);
      regimeState = maybeTransition(regimeState, anchorPrice);
      const { candle, nextState } = generateRegimeCandle(basePrice, regimeState);

      historyRows.push({
        product_id: p.id,
        recorded_at: minuteBucket.toISOString(),
        open_price: candle.open,
        high_price: candle.high,
        low_price: candle.low,
        close_price: candle.close,
        volume: candle.volume,
      });

      stateUpserts.push({
        product_id: p.id,
        last_price: candle.close,
        last_recorded_at: tickTime.toISOString(),
        extra: {
          ...(state?.extra ?? {}),
          regime: nextState.regime,
          ticksInRegime: nextState.ticksInRegime,
          momentum: nextState.momentum,
          vol: nextState.vol,
          anchor: nextState.anchor ?? null,
        },
        updated_at: tickTime.toISOString(),
      });

      productUpdates.push({ id: p.id, price: candle.close });
    }

    // 4. Write price_history using the actual schema and minute-level unique key
    if (historyRows.length > 0) {
      const { error } = await supabase
        .from('price_history')
        .upsert(historyRows, {
          onConflict: 'product_id,recorded_at',
          ignoreDuplicates: false,
        });
      if (error) console.warn('price_history upsert:', error.message);
    }

    // 5. Upsert engine_state
    if (stateUpserts.length > 0) {
      const { error } = await supabase
        .from('engine_state')
        .upsert(stateUpserts, { onConflict: 'product_id' });
      if (error) console.warn('engine_state upsert:', error.message);
    }

    // 6. Update products.price for quick reads
    for (const u of productUpdates) {
      await supabase.from('products').update({ price: u.price, updated_at: tickTime.toISOString() }).eq('id', u.id);
    }

    // 7. Mark shocks as applied
    if (appliedShockIds.length > 0) {
      await supabase
        .from('shock_events')
        .update({ applied: true, applied_at: tickTime.toISOString() })
        .in('id', appliedShockIds);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        ticked: list.length,
        shocks_applied: appliedShockIds.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    console.error('market-engine-tick error', e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});