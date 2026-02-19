/// <reference lib="deno.ns" />

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  "https://stengg.it.com",
  "https://www.stengg.it.com",
  "https://stengg-it-com.lovable.app",
  "https://id-preview--f9a00261-b7fb-4428-ad85-88f8d5788c27.lovable.app",
  "https://f9a00261-b7fb-4428-ad85-88f8d5788c27.lovableproject.com",
  "http://localhost:5173",
  "http://localhost:8080",
];

function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

interface LivePriceResult {
  productId: string;
  symbol: string;
  price: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  candleTime: string | null;
  success: boolean;
  error?: string;
}

interface PriceControl {
  direction: "bull" | "bear" | "neutral";
  strength: number; // 1 = default, 2 = 2x volatility, etc.
}

/**
 * Generate a realistic candle via random walk with optional trend bias.
 * Includes mean-reversion to prevent runaway price drift.
 *
 * @param basePrice     - The current price (last close)
 * @param referencePrice - The anchor price (e.g. session open) used for mean-reversion
 * @param control       - Price control settings (direction + strength)
 */
function generateCandle(
  basePrice: number,
  referencePrice: number,
  control: PriceControl,
): { open: number; high: number; low: number; close: number } {
  const baseVolatility = 0.0005; // 0.05% per tick
  const volatility = baseVolatility * Math.max(0.1, control.strength);

  // Trend bias: bull = positive lean, bear = negative lean, neutral = none
  // Cap bias at ±0.3 so it's a gentle nudge, not a runaway
  const rawBias =
    control.direction === "bull" ? 0.3
    : control.direction === "bear" ? -0.3
    : 0;

  // Mean-reversion force: if price has drifted > 5% from reference, pull it back
  // This prevents compounding bull/bear from causing runaway prices
  const drift = (basePrice - referencePrice) / referencePrice; // relative drift
  const maxDrift = 0.05; // 5% max allowed drift from reference
  let reversionBias = 0;
  if (Math.abs(drift) > maxDrift) {
    // Apply a corrective force proportional to how far we've drifted
    const excess = Math.abs(drift) - maxDrift;
    reversionBias = -Math.sign(drift) * Math.min(0.6, excess * 4);
  }

  const bias = rawBias + reversionBias;

  // Random movement with bias (-1 to +1, shifted by bias)
  const random = Math.random() * 2 - 1; // -1..+1
  const movement = (random + bias) * volatility * basePrice;

  const open = basePrice;
  const close = Math.max(0.000001, basePrice + movement);
  const spread = Math.abs(movement) * (0.5 + Math.random() * 0.5);
  const high = Math.max(open, close) + spread;
  const low = Math.max(0.000001, Math.min(open, close) - spread);

  return { open, high, low, close };
}

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    return new Response(JSON.stringify({ error: "Origin not allowed" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const body = await req.json().catch(() => ({}));
    const filterIds: string[] | null = Array.isArray(body?.productIds) ? body.productIds : null;

    // Fetch available products
    let query = db.from("products").select("id, name, symbol, price").eq("status", "available");
    if (filterIds && filterIds.length > 0) {
      query = query.in("id", filterIds);
    }
    const { data: products, error: prodErr } = await query;
    if (prodErr || !products) {
      return new Response(JSON.stringify({ error: "Failed to fetch products" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (products.length === 0) {
      return new Response(JSON.stringify({ success: true, synced: 0, failed: 0, results: [] }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch all price controls in one query
    const productIds = products.map((p) => p.id);
    const { data: controls } = await db
      .from("product_price_controls")
      .select("product_id, direction, strength")
      .in("product_id", productIds);

    // Build a map: productId -> PriceControl
    const controlMap = new Map<string, PriceControl>();
    for (const c of controls ?? []) {
      controlMap.set(c.product_id, {
        direction: (c.direction ?? "neutral") as PriceControl["direction"],
        strength: typeof c.strength === "number" ? c.strength : 1,
      });
    }

    const results: LivePriceResult[] = [];
    const now = new Date();
    // Round down to current 1-minute candle boundary
    const candleTime = new Date(Math.floor(now.getTime() / 60000) * 60000).toISOString();

    const tasks = products.map(async (product) => {
      const symbol = product.symbol ?? product.name ?? "UNKNOWN";
      const control: PriceControl = controlMap.get(product.id) ?? { direction: "neutral", strength: 1 };

      try {
        // Get the most recent price
        let basePrice: number | null = typeof product.price === "number" ? product.price : null;

        if (!basePrice || basePrice <= 0) {
          const { data: lastCandle } = await db
            .from("price_history")
            .select("close_price")
            .eq("product_id", product.id)
            .order("recorded_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (lastCandle?.close_price) {
            basePrice = lastCandle.close_price;
          }
        }

        if (!basePrice || basePrice <= 0) {
          results.push({
            productId: product.id, symbol,
            price: null, open: null, high: null, low: null, candleTime: null,
            success: false, error: "No base price available",
          });
          return;
        }

        // Fetch an anchor price from ~1 hour ago to use as mean-reversion reference
        // This prevents compounding bull/bear drift from causing runaway prices
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
        const { data: anchorCandle } = await db
          .from("price_history")
          .select("close_price")
          .eq("product_id", product.id)
          .lte("recorded_at", oneHourAgo)
          .order("recorded_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        // Use anchor from 1h ago; if not available fall back to basePrice (no reversion)
        const referencePrice = anchorCandle?.close_price ?? basePrice;

        // Generate candle with price control + mean-reversion applied
        const candle = generateCandle(basePrice, referencePrice, control);
        const newPrice = candle.close;

        // 1. Update product.price
        const priceChanged = Math.abs(basePrice - newPrice) > 0.000001;
        if (priceChanged) {
          await db
            .from("products")
            .update({ price: newPrice, updated_at: new Date().toISOString() })
            .eq("id", product.id);
        }

        // 2. Upsert the running 1m candle into price_history
        await db
          .from("price_history")
          .upsert({
            product_id: product.id,
            recorded_at: candleTime,
            open_price: candle.open,
            high_price: candle.high,
            low_price: candle.low,
            close_price: candle.close,
            volume: 0,
          }, {
            onConflict: "product_id,recorded_at",
            ignoreDuplicates: false,
          });

        results.push({
          productId: product.id, symbol,
          price: newPrice,
          open: candle.open,
          high: candle.high,
          low: candle.low,
          candleTime,
          success: true,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        results.push({
          productId: product.id, symbol,
          price: null, open: null, high: null, low: null, candleTime: null,
          success: false, error: msg,
        });
      }
    });

    await Promise.all(tasks);

    const succeeded = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    console.log(`[sync-live-price] Done: ${succeeded} ok, ${failed} failed`);

    return new Response(JSON.stringify({
      success: true,
      synced: succeeded,
      failed,
      results,
      timestamp: new Date().toISOString(),
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[sync-live-price] Fatal:", msg);
    return new Response(JSON.stringify({ error: "Unexpected error", message: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
