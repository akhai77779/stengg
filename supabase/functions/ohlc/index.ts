/// <reference lib="deno.ns" />

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EXTERNAL_KLINE_API_URL = "https://admin.stenggg.com/api/app/option/getKline";

type Timeframe = "1m" | "30m" | "1h" | "1d";

interface KlineItem {
  time?: number;
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
  data?: KlineItem[] | {
    list?: KlineItem[];
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

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
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

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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

    const limit = clamp(Math.floor(limitRaw), 50, 500);

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

    const response = await fetch(apiUrl, {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "User-Agent": "ST-Engineering-Chart/1.0",
      },
    });

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
    let klineList: KlineItem[] = [];
    if (Array.isArray(apiData.data)) {
      klineList = apiData.data;
    } else if (apiData.data?.list && Array.isArray(apiData.data.list)) {
      klineList = apiData.data.list;
    }

    console.log(`Received ${klineList.length} kline items`);

    // Convert to candle format
    const candles = klineList.map((item) => {
      // Handle different field naming conventions
      const time = item.time ?? item.t ?? 0;
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

    return new Response(JSON.stringify({ candles, nextCursor, symbol }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ohlc function error", e);
    return new Response(JSON.stringify({ error: "Unexpected error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
