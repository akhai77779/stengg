/// <reference lib="deno.ns" />

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// In-memory cache
interface CacheEntry {
  data: { candles: unknown[]; nextCursor: string | null; symbol: string };
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();

function getCacheTTL(timeframe: string): number {
  switch (timeframe) {
    case "1m": return 10 * 1000;
    case "5m": return 15 * 1000;
    case "15m": return 20 * 1000;
    case "30m": return 30 * 1000;
    case "1h": return 60 * 1000;
    case "1d": return 5 * 60 * 1000;
    default: return 30 * 1000;
  }
}

function getCacheKey(productId: string, timeframe: string, limit: number, cursor: string | null): string {
  return `${productId}:${timeframe}:${limit}:${cursor || "latest"}`;
}

function getCachedData(key: string, ttl: number): CacheEntry["data"] | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > ttl) { cache.delete(key); return null; }
  return entry.data;
}

function setCacheData(key: string, data: CacheEntry["data"]): void {
  cache.set(key, { data, timestamp: Date.now() });
  if (cache.size > 100) {
    const now = Date.now();
    for (const [k, v] of cache.entries()) {
      if (now - v.timestamp > 5 * 60 * 1000) cache.delete(k);
    }
  }
}

type Timeframe = "1m" | "5m" | "15m" | "30m" | "1h" | "1d";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function getMinutesForTimeframe(tf: Timeframe): number {
  switch (tf) {
    case "1m": return 1;
    case "5m": return 5;
    case "15m": return 15;
    case "30m": return 30;
    case "1h": return 60;
    case "1d": return 1440;
    default: return 1;
  }
}

/**
 * Apply price control bias to candle data
 */
function applyPriceControlToCandles(
  candles: { time: string; open: number; high: number; low: number; close: number }[],
  direction: string,
  strength: number
): { time: string; open: number; high: number; low: number; close: number }[] {
  if (candles.length === 0) return candles;

  const bias = direction === 'up' ? 1 : -1;

  return candles.map((c, i) => {
    const progress = (i + 1) / candles.length;
    const factor = 1 + bias * (strength * 0.001) * progress * (0.5 + Math.random() * 0.5);

    return {
      time: c.time,
      open: c.open * factor,
      high: c.high * (direction === 'up' ? factor * (1 + Math.random() * 0.0005) : factor),
      low: c.low * (direction === 'down' ? factor * (1 - Math.random() * 0.0005) : factor),
      close: c.close * factor,
    };
  });
}

/**
 * Aggregate 1m rows into larger timeframes
 */
function aggregateOHLC(
  rows: { recorded_at: string; open_price: number; high_price: number; low_price: number; close_price: number }[],
  minutes: number
): { time: string; open: number; high: number; low: number; close: number }[] {
  if (minutes === 1) {
    return rows.map(r => ({
      time: r.recorded_at,
      open: r.open_price,
      high: r.high_price,
      low: r.low_price,
      close: r.close_price,
    }));
  }

  const buckets = new Map<number, { open: number; high: number; low: number; close: number; time: string }>();
  const bucketMs = minutes * 60 * 1000;

  for (const r of rows) {
    const ts = new Date(r.recorded_at).getTime();
    const bucketKey = Math.floor(ts / bucketMs) * bucketMs;
    const existing = buckets.get(bucketKey);
    if (!existing) {
      buckets.set(bucketKey, {
        time: new Date(bucketKey).toISOString(),
        open: r.open_price,
        high: r.high_price,
        low: r.low_price,
        close: r.close_price,
      });
    } else {
      existing.high = Math.max(existing.high, r.high_price);
      existing.low = Math.min(existing.low, r.low_price);
      existing.close = r.close_price;
    }
  }

  return Array.from(buckets.values()).sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return new Response(JSON.stringify({ error: "Server misconfigured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: authHeader ? { Authorization: authHeader } : {} },
    });

    const body = await req.json().catch(() => ({}));
    const productId = typeof body.productId === "string" ? body.productId : "";
    const timeframe = (body.timeframe as Timeframe) ?? "1h";
    const limitRaw = typeof body.limit === "number" ? body.limit : 200;
    const cursor = typeof body.cursor === "string" ? body.cursor : null;

    if (!productId) {
      return new Response(JSON.stringify({ error: "productId is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(productId)) {
      return new Response(JSON.stringify({ error: "Invalid productId format" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const limit = clamp(Math.floor(limitRaw), 10, 500);

    // Check price controls
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    let activeControl: { direction: string; strength: number } | null = null;

    if (SUPABASE_SERVICE_ROLE_KEY) {
      const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const { data: ctrl } = await adminClient
        .from("product_price_controls")
        .select("direction, strength, is_active, expires_at")
        .eq("product_id", productId)
        .eq("is_active", true)
        .maybeSingle();

      if (ctrl && ctrl.is_active) {
        if (ctrl.expires_at && new Date(ctrl.expires_at) <= new Date()) {
          await adminClient
            .from("product_price_controls")
            .update({ is_active: false, direction: 'neutral', strength: 1, expires_at: null })
            .eq("product_id", productId);
        } else {
          activeControl = { direction: ctrl.direction, strength: ctrl.strength };
        }
      }
    }

    // Only use cache if no active control
    if (!activeControl) {
      const cacheKey = getCacheKey(productId, timeframe, limit, cursor);
      const cacheTTL = getCacheTTL(timeframe);
      const cachedData = getCachedData(cacheKey, cacheTTL);
      
      if (cachedData) {
        return new Response(JSON.stringify(cachedData), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Fetch product symbol
    const { data: product, error: productError } = await supabase
      .from("products")
      .select("name, symbol")
      .eq("id", productId)
      .maybeSingle();

    if (productError || !product) {
      return new Response(JSON.stringify({ error: "Product not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const symbol = product.symbol || product.name || "";

    // Read from price_history table (local DB only)
    let query = supabase
      .from("price_history")
      .select("recorded_at, open_price, high_price, low_price, close_price")
      .eq("product_id", productId)
      .order("recorded_at", { ascending: true });

    if (cursor) {
      query = query.lt("recorded_at", cursor);
    }

    // Fetch more raw rows for aggregation
    const minutesPerBucket = getMinutesForTimeframe(timeframe);
    const fetchLimit = Math.min(limit * minutesPerBucket, 1000);

    const { data: rows, error: dbError } = await query.limit(fetchLimit);

    if (dbError) {
      console.error("DB error:", dbError.message);
      return new Response(JSON.stringify({ candles: [], nextCursor: null, symbol }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Aggregate into requested timeframe
    let candles = aggregateOHLC(rows || [], minutesPerBucket);

    // Apply price control bias if active
    if (activeControl) {
      console.log(`[PriceControl] Applying ${activeControl.direction} x${activeControl.strength} to ${candles.length} candles`);
      candles = applyPriceControlToCandles(candles, activeControl.direction, activeControl.strength);
    }

    const nextCursor = candles.length > 0 ? candles[0].time : null;

    const responseData = { candles, nextCursor, symbol };

    // Only cache if no active control
    if (!activeControl) {
      const cacheKey = getCacheKey(productId, timeframe, limit, cursor);
      setCacheData(cacheKey, responseData);
    }

    return new Response(JSON.stringify(responseData), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ohlc function error", e);
    return new Response(JSON.stringify({ error: "Unexpected error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
