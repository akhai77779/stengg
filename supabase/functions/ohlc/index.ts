/// <reference lib="deno.ns" />

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Allowed origins for CORS - restrict to known domains
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

const DEFAULT_BASE_URL = "https://admin.stenggg.com";
const DEFAULT_KLINE_PATH = "/api/app/option/getKline";

// In-memory cache for kline data
interface CacheEntry {
  data: { candles: unknown[]; nextCursor: string | null; symbol: string };
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();

// Cache TTL based on timeframe (in milliseconds)
function getCacheTTL(timeframe: string): number {
  switch (timeframe) {
    case "1m": return 10 * 1000;      // 10 seconds for 1-minute chart
    case "5m": return 15 * 1000;      // 15 seconds for 5-minute chart
    case "15m": return 20 * 1000;     // 20 seconds for 15-minute chart
    case "30m": return 30 * 1000;     // 30 seconds for 30-minute chart
    case "1h": return 60 * 1000;      // 1 minute for 1-hour chart
    case "1d": return 5 * 60 * 1000;  // 5 minutes for daily chart
    default: return 30 * 1000;
  }
}

// Generate cache key from request parameters
function getCacheKey(productId: string, timeframe: string, limit: number, cursor: string | null): string {
  return `${productId}:${timeframe}:${limit}:${cursor || "latest"}`;
}

// Get cached data if valid
function getCachedData(key: string, ttl: number): CacheEntry["data"] | null {
  const entry = cache.get(key);
  if (!entry) return null;
  
  const now = Date.now();
  if (now - entry.timestamp > ttl) {
    cache.delete(key);
    return null;
  }
  
  return entry.data;
}

// Set cache data
function setCacheData(key: string, data: CacheEntry["data"]): void {
  cache.set(key, { data, timestamp: Date.now() });
  
  // Clean up old entries (keep cache size reasonable)
  if (cache.size > 100) {
    const now = Date.now();
    for (const [k, v] of cache.entries()) {
      if (now - v.timestamp > 5 * 60 * 1000) { // Remove entries older than 5 minutes
        cache.delete(k);
      }
    }
  }
}

type Timeframe = "1m" | "5m" | "15m" | "30m" | "1h" | "1d";

interface KlineItem {
  time?: number;
  ts?: number; // API uses 'ts' for timestamp
  open?: number | string;
  high?: number | string;
  low?: number | string;
  close?: number | string;
  vol?: number | string;
  // Alternative field names
  t?: number;
  o?: number | string;
  h?: number | string;
  l?: number | string;
  c?: number | string;
  v?: number | string;
}

interface KlineApiResponse {
  code?: number;
  message?: string;
  // API structure: { data: { data: KlineItem[], ch: string, ts: number } }
  data?: KlineItem[] | {
    list?: KlineItem[];
    data?: KlineItem[]; // Nested data.data structure
  };
}

function timeframeToPeriod(tf: Timeframe): string {
  switch (tf) {
    case "1m": return "1min";
    case "5m": return "5min";
    case "15m": return "15min";
    case "30m": return "30min";
    case "1h": return "1hour";
    case "1d": return "1day";
    default: return "1hour";
  }
}

function timeframeToSeconds(tf: Timeframe): number {
  switch (tf) {
    case "1m": return 60;
    case "5m": return 5 * 60;
    case "15m": return 15 * 60;
    case "30m": return 30 * 60;
    case "1h": return 60 * 60;
    case "1d": return 24 * 60 * 60;
    default: return 60 * 60;
  }
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

// Retry fetch with exponential backoff for transient network errors
async function fetchWithRetry(
  url: string, 
  options: RequestInit, 
  retries = 3, 
  delayMs = 500
): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      return response;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`Fetch attempt ${i + 1}/${retries} failed:`, lastError.message);
      
      if (i < retries - 1) {
        // Wait before retrying with exponential backoff
        await new Promise(resolve => setTimeout(resolve, delayMs * Math.pow(2, i)));
      }
    }
  }
  
  throw lastError || new Error("Fetch failed after retries");
}

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Validate origin for actual requests (not just preflight)
  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    console.warn(`Rejected request from unauthorized origin: ${origin}`);
    return new Response(
      JSON.stringify({ error: "Origin not allowed" }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.error("Missing SUPABASE_URL or SUPABASE_ANON_KEY");
      return new Response(JSON.stringify({ error: "Server misconfigured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create Supabase client with optional auth header (for RLS if needed)
    const authHeader = req.headers.get("Authorization");
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: authHeader ? { Authorization: authHeader } : {},
      },
    });

    // Read external API base URL from app_settings (using service role to bypass RLS)
    let klineApiUrl = `${DEFAULT_BASE_URL}${DEFAULT_KLINE_PATH}`;
    try {
      const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY);
      const { data: apiConfigRow } = await serviceClient
        .from("app_settings")
        .select("value")
        .eq("key", "external_api_config")
        .maybeSingle();

      if (apiConfigRow?.value) {
        const cfg = apiConfigRow.value as { base_url?: string; enabled?: boolean };
        if (cfg.base_url && /^https?:\/\/.+/.test(cfg.base_url)) {
          klineApiUrl = `${cfg.base_url.replace(/\/$/, "")}${DEFAULT_KLINE_PATH}`;
          console.log(`Using configured API base URL: ${cfg.base_url}`);
        }
      }
    } catch (cfgErr) {
      console.warn("Could not read external_api_config, using default:", cfgErr);
    }

    const body = await req.json().catch(() => ({}));
    const productId = typeof body.productId === "string" ? body.productId : "";
    const timeframe = (body.timeframe as Timeframe) ?? "1h";
    const limitRaw = typeof body.limit === "number" ? body.limit : 200;
    const cursor = typeof body.cursor === "string" ? body.cursor : null;

    if (!productId) {
      return new Response(JSON.stringify({ error: "productId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(productId)) {
      console.error("Invalid productId format:", productId);
      return new Response(JSON.stringify({ error: "Invalid productId format" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const limit = clamp(Math.floor(limitRaw), 50, 500);

    // Check cache first (before fetching product info for "latest" requests only)
    const cacheKey = getCacheKey(productId, timeframe, limit, cursor);
    const cacheTTL = getCacheTTL(timeframe);
    const cachedData = getCachedData(cacheKey, cacheTTL);
    
    if (cachedData) {
      console.log(`Cache HIT for key: ${cacheKey}`);
      return new Response(JSON.stringify(cachedData), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    console.log(`Cache MISS for key: ${cacheKey}`);

    // Fetch product to get symbol
    const { data: product, error: productError } = await supabase
      .from("products")
      .select("name, symbol")
      .eq("id", productId)
      .maybeSingle();

    if (productError || !product) {
      console.error("Product not found:", productError);
      return new Response(JSON.stringify({ error: "Product not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use symbol if available, otherwise try to derive from name
    let symbol = product.symbol;
    if (!symbol) {
      // Try common patterns: "Bitcoin" -> "BTC/USDT", "Wing-in-Ground" -> "WIG/USDT"
      const name = product.name || "";
      if (name.toLowerCase().includes("wing") || name.toLowerCase().includes("wig")) {
        symbol = "WIG/USDT";
      } else {
        // Default fallback - use first 3-4 chars of name
        symbol = name.replace(/[^A-Za-z0-9]/g, "").substring(0, 4).toUpperCase() + "/USDT";
      }
    }

    // Calculate time range
    const bucketSec = timeframeToSeconds(timeframe);
    const now = Math.floor(Date.now() / 1000);
    const toTimestamp = cursor ? Math.floor(new Date(cursor).getTime() / 1000) : now;
    const fromTimestamp = toTimestamp - (bucketSec * limit);

    // Build external API URL
    const period = timeframeToPeriod(timeframe);
    const encodedSymbol = encodeURIComponent(symbol);
    const apiUrl = `${klineApiUrl}?symbol=${encodedSymbol}&period=${period}&size=${limit}&from=${fromTimestamp}&to=${toTimestamp}&zip=0`;

    console.log(`Fetching kline data from: ${apiUrl}`);

    // Helper: fallback to price_history table in DB
    async function fallbackToPriceHistory(): Promise<Response> {
      console.log(`Falling back to price_history DB for product ${productId}, timeframe ${timeframe}`);
      try {
        const serviceClient = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY!);
        
        // Determine bucket size in minutes based on timeframe
        const bucketMinutes: Record<string, number> = {
          "1m": 1, "5m": 5, "15m": 15, "30m": 30, "1h": 60, "1d": 1440
        };
        const bucketMin = bucketMinutes[timeframe] ?? 1;
        
        const { data: rows, error: dbErr } = await serviceClient
          .from("price_history")
          .select("recorded_at, open_price, high_price, low_price, close_price")
          .eq("product_id", productId)
          .order("recorded_at", { ascending: false })
          .limit(limit * (bucketMin === 1 ? 1 : bucketMin));

        if (dbErr || !rows || rows.length === 0) {
          console.log("No price_history data found, returning empty candles");
          return new Response(JSON.stringify({ candles: [], nextCursor: null, symbol }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // For 1m timeframe, use rows directly
        let candles: { time: string; open: number; high: number; low: number; close: number }[] = [];

        if (bucketMin === 1) {
          candles = rows.map(r => ({
            time: r.recorded_at,
            open: r.open_price,
            high: r.high_price,
            low: r.low_price,
            close: r.close_price,
          })).reverse();
        } else {
          // Aggregate rows into larger timeframe buckets
          const bucketMap = new Map<number, { open: number; high: number; low: number; close: number; firstTs: number }>();
          const bucketMs = bucketMin * 60 * 1000;
          
          for (const r of [...rows].reverse()) {
            const ts = new Date(r.recorded_at).getTime();
            const bucketTs = Math.floor(ts / bucketMs) * bucketMs;
            const existing = bucketMap.get(bucketTs);
            if (!existing) {
              bucketMap.set(bucketTs, { open: r.open_price, high: r.high_price, low: r.low_price, close: r.close_price, firstTs: ts });
            } else {
              existing.high = Math.max(existing.high, r.high_price);
              existing.low = Math.min(existing.low, r.low_price);
              existing.close = r.close_price;
            }
          }
          
          candles = Array.from(bucketMap.entries())
            .sort(([a], [b]) => a - b)
            .slice(-limit)
            .map(([ts, v]) => ({
              time: new Date(ts).toISOString(),
              open: v.open,
              high: v.high,
              low: v.low,
              close: v.close,
            }));
        }

        console.log(`DB fallback: returning ${candles.length} candles`);
        const responseData = { candles, nextCursor: null, symbol, source: "db_fallback" };
        setCacheData(cacheKey, responseData);
        return new Response(JSON.stringify(responseData), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (fallbackErr) {
        console.error("DB fallback error:", fallbackErr);
        return new Response(JSON.stringify({ candles: [], nextCursor: null, symbol }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Use fetchWithRetry for resilience against transient network errors
    let response: Response;
    try {
      response = await fetchWithRetry(apiUrl, {
        method: "GET",
        headers: {
          "Accept": "application/json",
          "User-Agent": "ST-Engineering-Chart/1.0",
        },
      }, 2, 300);
    } catch (fetchError) {
      console.error(`External API fetch failed after retries:`, fetchError);
      // Fallback to price_history DB
      return fallbackToPriceHistory();
    }

    if (!response.ok) {
      console.error(`External API error: ${response.status}`);
      // Fallback to price_history DB on API error
      return fallbackToPriceHistory();
    }

    const apiData: KlineApiResponse = await response.json();
    console.log("API response code:", apiData.code);

    // Extract kline data - handle different response formats
    // API returns: { data: { data: [...], ch: "...", ts: ... } }
    let klineList: KlineItem[] = [];
    if (Array.isArray(apiData.data)) {
      klineList = apiData.data;
    } else if (apiData.data && typeof apiData.data === 'object') {
      // Check for nested data.data structure
      if ('data' in apiData.data && Array.isArray((apiData.data as { data?: KlineItem[] }).data)) {
        klineList = (apiData.data as { data: KlineItem[] }).data;
      } else if (apiData.data?.list && Array.isArray(apiData.data.list)) {
        klineList = apiData.data.list;
      }
    }

    console.log(`Received ${klineList.length} kline items`);
    if (klineList.length > 0) {
      console.log('Sample kline item:', JSON.stringify(klineList[0]));
    } else {
      // External API returned empty data - fallback to DB
      console.log("External API returned empty kline data, falling back to DB");
      return fallbackToPriceHistory();
    }

    // Convert to candle format
    const candles = klineList.map((item) => {
      // Handle different field naming conventions - API uses 'ts' for timestamp
      const time = item.ts ?? item.time ?? item.t ?? 0;
      const open = Number(item.open ?? item.o ?? 0);
      const high = Number(item.high ?? item.h ?? 0);
      const low = Number(item.low ?? item.l ?? 0);
      const close = Number(item.close ?? item.c ?? 0);

      return {
        time: new Date(time * 1000).toISOString(),
        open,
        high,
        low,
        close,
      };
    }).filter(c => c.open > 0 || c.close > 0) // Filter out invalid candles
      .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

    // Calculate next cursor for pagination
    const nextCursor = candles.length > 0 
      ? new Date(fromTimestamp * 1000).toISOString()
      : null;

    // Cache the result
    const responseData = { candles, nextCursor, symbol };
    setCacheData(cacheKey, responseData);
    console.log(`Cached data for key: ${cacheKey}, TTL: ${cacheTTL}ms`);

    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ohlc function error", e);
    const origin = req.headers.get("Origin");
    const corsHeaders = getCorsHeaders(origin);
    return new Response(JSON.stringify({ error: "Unexpected error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
