import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import {
  generateRegimeCandle,
  initialRegimeState,
  maybeTransition,
  getBasePrice,
  type RegimeState,
} from "../market-engine-tick/index.ts";

// Backfill candles using the SAME regime engine as live ticks so historical
// candles look identical to live-generated ones.
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