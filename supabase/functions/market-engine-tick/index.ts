import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

interface ProductRow {
  id: string;
  price: number | null;
  status: string;
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

const BASE_VOLATILITY = 0.004; // 0.4% per tick baseline
const MOMENTUM_DECAY = 0.7;
const MOMENTUM_PUSH = 0.0015; // random push std per tick
const VOL_DECAY = 0.85; // vol mean-reverts toward baseline

// Box-Muller approx for ~normal random
function gauss(): number {
  const u = Math.max(1e-9, Math.random());
  const v = Math.max(1e-9, Math.random());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

interface NextPriceResult {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  nextMomentum: number;
  nextVol: number;
}

function generateNextPrice(
  prev: number,
  momentum = 0,
  vol = BASE_VOLATILITY,
): NextPriceResult {
  const open = prev;

  // 1. Momentum: decay + small random push
  const push = gauss() * MOMENTUM_PUSH;
  let nextMomentum = momentum * MOMENTUM_DECAY + push;
  // Clamp momentum so it doesn't run away
  const momCap = BASE_VOLATILITY * 3;
  if (nextMomentum > momCap) nextMomentum = momCap;
  if (nextMomentum < -momCap) nextMomentum = -momCap;

  // 2. Volatility clustering: random shock scaled by current vol
  const shock = gauss() * vol;
  const drift = nextMomentum + shock;
  const close = Math.max(0.0001, open * (1 + drift));

  // Body size relative to price
  const bodyPct = Math.abs(close - open) / Math.max(open, 1e-9);

  // Update vol: react to realized move, decay toward baseline
  const realized = Math.abs(drift);
  let nextVol = vol * VOL_DECAY + realized * (1 - VOL_DECAY) + BASE_VOLATILITY * 0.15;
  // Mean-revert toward baseline a bit more strongly when far above
  nextVol = nextVol * 0.9 + BASE_VOLATILITY * 0.1;
  // Floor & ceiling
  if (nextVol < BASE_VOLATILITY * 0.5) nextVol = BASE_VOLATILITY * 0.5;
  if (nextVol > BASE_VOLATILITY * 5) nextVol = BASE_VOLATILITY * 5;

  // 3. Natural wicks: multiplier 0.3x - 3x of body, with occasional long wicks
  const wickHighMult = 0.3 + Math.random() * 2.7;
  const wickLowMult = 0.3 + Math.random() * 2.7;
  // Minimum wick relative to price so flat candles still show wicks
  const minWick = Math.max(bodyPct, vol * 0.3);
  const hi = Math.max(open, close) * (1 + minWick * wickHighMult * 0.5);
  const lo = Math.min(open, close) * (1 - minWick * wickLowMult * 0.5);

  // 4. Volume correlated with magnitude of move
  const moveRatio = bodyPct / BASE_VOLATILITY; // ~1 for normal move
  const baseVol = 2000;
  const volSpike = baseVol * moveRatio * (0.5 + Math.random() * 1.5);
  const noise = Math.random() * 1500;
  const volume = Math.round(baseVol + volSpike + noise);

  return { open, high: hi, low: lo, close, volume, nextMomentum, nextVol };
}

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
      .select('id, price, status')
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
      let basePrice = state?.last_price ?? p.price ?? 100;
      if (!Number.isFinite(basePrice) || basePrice <= 0) basePrice = 100;

      // Apply pending shocks first
      const productShocks = shocksByProduct.get(p.id) ?? [];
      for (const sh of productShocks) {
        basePrice = applyShock(basePrice, sh);
        appliedShockIds.push(sh.id);
      }

      const prevMomentum = Number((state?.extra as any)?.momentum ?? 0);
      const prevVol = Number((state?.extra as any)?.vol ?? BASE_VOLATILITY);
      const candle = generateNextPrice(basePrice, prevMomentum, prevVol);

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
          momentum: candle.nextMomentum,
          vol: candle.nextVol,
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