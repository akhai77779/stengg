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

/**
 * Generate a realistic random walk candle from a base price.
 * Volatility is ~0.05% per tick (suitable for financial instruments).
 */
function generateCandle(basePrice: number): {
  open: number;
  high: number;
  low: number;
  close: number;
} {
  const volatility = 0.0005; // 0.05%
  const change = basePrice * volatility * (Math.random() * 2 - 1);
  const open = basePrice;
  const close = Math.max(0.000001, basePrice + change);
  const spread = Math.abs(change) * (0.5 + Math.random());
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

    const results: LivePriceResult[] = [];
    const now = new Date();
    // Round down to current 1-minute candle boundary
    const candleTime = new Date(Math.floor(now.getTime() / 60000) * 60000).toISOString();

    const tasks = products.map(async (product) => {
      const symbol = product.symbol ?? product.name ?? "UNKNOWN";

      try {
        // Get the most recent price for this product (from price_history or products.price)
        let basePrice: number | null = typeof product.price === "number" ? product.price : null;

        if (!basePrice || basePrice <= 0) {
          // Fallback: get last close from price_history
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

        // Generate a new candle via random walk
        const candle = generateCandle(basePrice);
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

    const succeeded = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    console.log(`[sync-live-price] DB-only mode: ${succeeded} succeeded, ${failed} failed`);

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
