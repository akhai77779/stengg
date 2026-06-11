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

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  try {
    const body = await req.json().catch(() => ({}));
    const days: number = Number(body?.days ?? 30);
    const productIds: string[] | undefined = body?.productIds;
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
    const results: Record<string, { inserted: number; error?: string }> = {};

    for (const product of products) {
      try {
        const anchor = getBasePrice(product.symbol, product.price ?? 100);

        // Initialize regime state at sideways anchored to basePrice
        let state: RegimeState = initialRegimeState(anchor, "sideways");

        // Walk forward in chronological order so transitions/momentum evolve naturally,
        // then assign timestamps from oldest -> newest.
        const rows: any[] = [];
        let price = anchor;
        for (let step = 0; step < totalMinutes; step++) {
          state = maybeTransition(state, anchor);
          const { candle, nextState } = generateRegimeCandle(price, state);
          state = nextState;
          price = candle.close;

          const minuteMs = nowMinute - (totalMinutes - step) * 60000;
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

        // Clear old history then chunk-upsert
        await supabase.from("price_history").delete().eq("product_id", product.id);

        let inserted = 0;
        const CHUNK = 500;
        for (let i = 0; i < rows.length; i += CHUNK) {
          const chunk = rows.slice(i, i + CHUNK);
          const { error: insErr } = await supabase
            .from("price_history")
            .upsert(chunk, { onConflict: "product_id,recorded_at", ignoreDuplicates: false });
          if (insErr) throw new Error(insErr.message);
          inserted += chunk.length;
        }

        const last = rows[rows.length - 1];
        if (last) {
          await supabase.from("products").update({ price: last.close_price }).eq("id", product.id);
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