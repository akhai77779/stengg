import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

// Backfill candles using the SAME regime engine as live ticks so historical
// candles look identical to live-generated ones.

type Regime = "sideways" | "trending_up" | "trending_down" | "volatile";

interface RegimeState {
  regime: Regime;
  ticksInRegime: number;
  momentum: number;
  vol: number;
  anchor?: number;
}

interface GeneratedCandle {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const BASE_PRICES: Record<string, number> = {
  "AGIL/USDT": 601.94,
  "360SA/USDT": 40.75,
  "MCS/USDT": 14.51,
  "SIM/USDT": 9.06,
  "COTM/USDT": 9.12,
  "IBMS/USDT": 2.69,
  "VICS/USDT": 0.01,
  "HED/USDT": 6.49,
  "C5ISR/USDT": 1.0,
  "WIG/USDT": 0.23,
};

const REGIME_PARAMS: Record<Regime, {
  volMin: number;
  volMax: number;
  driftMin: number;
  driftMax: number;
  wickMultMin: number;
  wickMultMax: number;
  volumeMult: number;
}> = {
  sideways: { volMin: 0.001, volMax: 0.003, driftMin: -0.0002, driftMax: 0.0002, wickMultMin: 0.3, wickMultMax: 1.2, volumeMult: 0.5 },
  trending_up: { volMin: 0.003, volMax: 0.006, driftMin: 0.0010, driftMax: 0.0020, wickMultMin: 0.4, wickMultMax: 2.0, volumeMult: 1.2 },
  trending_down: { volMin: 0.003, volMax: 0.006, driftMin: -0.0020, driftMax: -0.0010, wickMultMin: 0.4, wickMultMax: 2.0, volumeMult: 1.2 },
  volatile: { volMin: 0.010, volMax: 0.020, driftMin: -0.0010, driftMax: 0.0010, wickMultMin: 1.0, wickMultMax: 4.0, volumeMult: 2.5 },
};

function getBasePrice(symbol: string | null | undefined, fallback: number): number {
  if (symbol && BASE_PRICES[symbol]) return BASE_PRICES[symbol];
  return fallback > 0 ? fallback : 1;
}

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function gauss(): number {
  const u = Math.max(1e-9, Math.random());
  const v = Math.max(1e-9, Math.random());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function pickRegime(prev?: Regime): Regime {
  const weights: Record<Regime, number> = {
    sideways: 0.40,
    trending_up: 0.25,
    trending_down: 0.25,
    volatile: 0.10,
  };
  if (prev) weights[prev] *= 0.3;
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (const [k, w] of Object.entries(weights)) {
    r -= w;
    if (r <= 0) return k as Regime;
  }
  return "sideways";
}

function maybeTransition(state: RegimeState, anchorPrice: number): RegimeState {
  const p = 0.02 + Math.min(state.ticksInRegime * 0.001, 0.13);
  if (Math.random() < p) {
    const next = pickRegime(state.regime);
    return {
      regime: next,
      ticksInRegime: 0,
      momentum: 0,
      vol: rand(REGIME_PARAMS[next].volMin, REGIME_PARAMS[next].volMax),
      anchor: anchorPrice,
    };
  }
  return { ...state, anchor: state.anchor ?? anchorPrice };
}

function generateRegimeCandle(
  prevClose: number,
  state: RegimeState,
): { candle: GeneratedCandle; nextState: RegimeState } {
  const params = REGIME_PARAMS[state.regime];
  let drift = rand(params.driftMin, params.driftMax);

  if (state.anchor && state.anchor > 0) {
    const dev = (prevClose - state.anchor) / state.anchor;
    const pull = state.regime === "sideways" ? 0.30 : state.regime === "volatile" ? 0.08 : 0.05;
    drift -= dev * pull;
  }

  const momentumDecay = state.regime === "sideways" ? 0.4 : state.regime === "volatile" ? 0.5 : 0.85;
  const newMomentum = state.momentum * momentumDecay + drift * 0.5;
  const open = prevClose;
  let close = Math.max(0.0001, open * (1 + newMomentum + gauss() * state.vol));

  if (state.regime === "sideways" && state.anchor) {
    const upper = state.anchor * 1.005;
    const lower = state.anchor * 0.995;
    if (close > upper) close = upper - Math.random() * (upper - state.anchor) * 0.3;
    if (close < lower) close = lower + Math.random() * (state.anchor - lower) * 0.3;
  }

  if (state.anchor && state.anchor > 0) {
    const hardMax = state.anchor * 2.0;
    const hardMin = state.anchor * 0.5;
    if (close > hardMax) close = hardMax - Math.random() * (hardMax - state.anchor) * 0.2;
    if (close < hardMin) close = hardMin + Math.random() * (state.anchor - hardMin) * 0.2;
  }

  const bodyPct = Math.abs(close - open) / Math.max(open, 1e-9);
  const baseWick = Math.max(bodyPct, state.vol * 0.5);
  const high = Math.max(open, close) * (1 + baseWick * rand(params.wickMultMin, params.wickMultMax) * 0.5);
  const low = Math.min(open, close) * (1 - baseWick * rand(params.wickMultMin, params.wickMultMax) * 0.5);
  const baseVol = 2000 * params.volumeMult;
  const volume = Math.round(baseVol * 0.4 + baseVol * Math.max(bodyPct / 0.004, 0.3) * (0.5 + Math.random() * 1.5) + Math.random() * 800);
  const targetVol = rand(params.volMin, params.volMax);

  return {
    candle: { open, high, low, close, volume },
    nextState: {
      regime: state.regime,
      ticksInRegime: state.ticksInRegime + 1,
      momentum: Math.max(-0.05, Math.min(0.05, newMomentum)),
      vol: state.vol * 0.9 + targetVol * 0.1,
      anchor: state.anchor,
    },
  };
}

function initialRegimeState(anchorPrice: number, regime?: Regime): RegimeState {
  const r = regime ?? pickRegime();
  return {
    regime: r,
    ticksInRegime: 0,
    momentum: 0,
    vol: rand(REGIME_PARAMS[r].volMin, REGIME_PARAMS[r].volMax),
    anchor: anchorPrice,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Admin-only: this function rewrites historical candles for every product.
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    return new Response(
      JSON.stringify({ ok: false, error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // Allow direct service-role/cron callers, otherwise require admin user.
  const isServiceRole = authHeader === `Bearer ${SERVICE_KEY}`;
  if (!isServiceRole) {
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(
        JSON.stringify({ ok: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const adminClient = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
    const { data: isAdmin, error: roleErr } = await adminClient.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "admin",
    });
    if (roleErr || isAdmin !== true) {
      return new Response(
        JSON.stringify({ ok: false, error: "Forbidden" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
  }

  const supabase = createClient(
    SUPABASE_URL,
    SERVICE_KEY,
    { auth: { persistSession: false } },
  );

  try {
    const body = await req.json().catch(() => ({}));
    const days: number = Number(body?.days ?? 30);
    const productIds: string[] | undefined = body?.productIds;
    const force: boolean = Boolean(body?.force ?? false);
    const SKIP_THRESHOLD = Number(body?.skipThreshold ?? 100);
    const totalMinutes = Math.max(1, Math.floor(days * 24 * 60));

    let query = supabase
      .from("products")
      .select("id, symbol, name, price")
      .eq("status", "available");
    if (productIds?.length) query = query.in("id", productIds);
    const { data: products, error: pErr } = await query;

    if (pErr || !products?.length) {
      return new Response(
        JSON.stringify({ ok: false, error: pErr?.message || "No products" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const nowMinute = Math.floor(Date.now() / 60000) * 60000;
    const results: Record<string, { inserted: number; skipped?: boolean; reason?: string; error?: string }> = {};

    for (const product of products) {
      try {
        // 1. Check existing history: count + oldest timestamp
        const { count: existingCount } = await supabase
          .from("price_history")
          .select("*", { count: "exact", head: true })
          .eq("product_id", product.id);

        if (!force && (existingCount ?? 0) >= SKIP_THRESHOLD) {
          results[product.id] = {
            inserted: 0,
            skipped: true,
            reason: `has ${existingCount} candles (>= ${SKIP_THRESHOLD}); pass force=true to override`,
          };
          continue;
        }

        // 2. Find oldest existing candle so we only fill the gap before it
        const { data: oldestRow } = await supabase
          .from("price_history")
          .select("recorded_at, open_price")
          .eq("product_id", product.id)
          .order("recorded_at", { ascending: true })
          .limit(1)
          .maybeSingle();

        // 3. Starting price: prefer engine_state.last_price (continues live tick data),
        //    else oldest existing open (so the gap connects), else basePrice.
        const { data: engineState } = await supabase
          .from("engine_state")
          .select("last_price, extra")
          .eq("product_id", product.id)
          .maybeSingle();

        const seedFromState = Number(engineState?.last_price);
        const seedFromOldest = oldestRow ? Number(oldestRow.open_price) : NaN;
        const fallback = getBasePrice(product.symbol, product.price ?? 100);
        const anchor = Number.isFinite(seedFromState) && seedFromState > 0
          ? seedFromState
          : Number.isFinite(seedFromOldest) && seedFromOldest > 0
            ? seedFromOldest
            : fallback;

        // Initialize regime state at sideways anchored to chosen anchor
        let state: RegimeState = initialRegimeState(anchor, "sideways");

        // Walk forward in chronological order so transitions/momentum evolve naturally,
        // then assign timestamps from oldest -> newest.
        const rows: any[] = [];
        let price = anchor;
        // End timestamp: just before oldest existing candle (gap fill), else nowMinute.
        const endMinute = oldestRow
          ? Math.floor(new Date(oldestRow.recorded_at).getTime() / 60000) * 60000 - 60000
          : nowMinute;

        for (let step = 0; step < totalMinutes; step++) {
          state = maybeTransition(state, anchor);
          const { candle, nextState } = generateRegimeCandle(price, state);
          state = nextState;
          price = candle.close;

          const minuteMs = endMinute - (totalMinutes - 1 - step) * 60000;
          rows.push({
            product_id: product.id,
            recorded_at: new Date(minuteMs).toISOString(),
            open_price: candle.open,
            high_price: candle.high,
            low_price: candle.low,
            close_price: candle.close,
            volume: candle.volume,
          });
        }

        // GAP-FILL ONLY: never delete existing rows. Upsert with ignoreDuplicates
        // so any overlap with existing candles is left untouched.

        let inserted = 0;
        const CHUNK = 500;
        for (let i = 0; i < rows.length; i += CHUNK) {
          const chunk = rows.slice(i, i + CHUNK);
          const { error: insErr } = await supabase
            .from("price_history")
            .upsert(chunk, { onConflict: "product_id,recorded_at", ignoreDuplicates: true });
          if (insErr) throw new Error(insErr.message);
          inserted += chunk.length;
        }

        // Only update products.price / engine_state when there was NO prior data
        // (fresh setup). Gap-fill must not overwrite live tick state.
        const last = rows[rows.length - 1];
        if (last && !oldestRow) {
          await supabase.from("products").update({ price: last.close_price }).eq("id", product.id);

          await supabase.from("engine_state").upsert(
            {
              product_id: product.id,
              last_price: last.close_price,
              last_recorded_at: last.recorded_at,
              extra: {
                regime: state.regime,
                ticksInRegime: state.ticksInRegime,
                momentum: state.momentum,
                vol: state.vol,
                anchor: state.anchor,
              },
            },
            { onConflict: "product_id" },
          );
        }

        results[product.id] = { inserted };
      } catch (e: unknown) {
        results[product.id] = { inserted: 0, error: String(e) };
      }
    }

    return new Response(JSON.stringify({ ok: true, days, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});