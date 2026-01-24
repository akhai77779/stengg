/// <reference lib="deno.ns" />

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Allowed origins for CORS - restrict to known domains
const ALLOWED_ORIGINS = [
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

const EXTERNAL_KLINE_API_URL = "https://admin.stenggg.com/api/app/option/getKline";

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

type Timeframe = "1m" | "30m" | "1h" | "1d";

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
    case "30m": return "30min";
    case "1h": return "1hour";
    case "1d": return "1day";
    default: return "1hour";
  }
}

function timeframeToSeconds(tf: Timeframe): number {
  switch (tf) {
    case "1m": return 60;
    case "30m": return 30 * 60;
    case "1h": return 60 * 60;
    case "1d": return 24 * 60 * 60;
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
    const apiUrl = `${EXTERNAL_KLINE_API_URL}?symbol=${encodedSymbol}&period=${period}&size=${limit}&from=${fromTimestamp}&to=${toTimestamp}&zip=0`;

    console.log(`Fetching kline data from: ${apiUrl}`);

    // Use fetchWithRetry for resilience against transient network errors
    let response: Response;
    try {
      response = await fetchWithRetry(apiUrl, {
        method: "GET",
        headers: {
          "Accept": "application/json",
          "User-Agent": "ST-Engineering-Chart/1.0",
        },
      }, 3, 300);
    } catch (fetchError) {
      console.error(`External API fetch failed after retries:`, fetchError);
      // Return empty candles instead of error to prevent UI breaking
      return new Response(JSON.stringify({ candles: [], nextCursor: null, symbol }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!response.ok) {
      console.error(`External API error: ${response.status}`);
      return new Response(JSON.stringify({ error: "Failed to fetch chart data", status: response.status }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
