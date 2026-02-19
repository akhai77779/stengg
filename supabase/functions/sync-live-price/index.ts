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

const DEFAULT_BASE_URL = "https://admin.stenggg.com";
const DEFAULT_KLINE_PATH = "/api/app/option/getKline";

function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

interface KlineItem {
  ts?: number; time?: number; t?: number;
  open?: number | string; o?: number | string;
  high?: number | string; h?: number | string;
  low?: number | string; l?: number | string;
  close?: number | string; c?: number | string;
  vol?: number | string; v?: number | string;
}

interface KlineApiResponse {
  code?: number;
  data?: KlineItem[] | { list?: KlineItem[]; data?: KlineItem[] };
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
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY) {
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Use service role for all DB operations
  const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // Parse body: optional productIds array to filter specific products
    const body = await req.json().catch(() => ({}));
    const filterIds: string[] | null = Array.isArray(body?.productIds) ? body.productIds : null;

    // Read external API config
    let klineBaseUrl = `${DEFAULT_BASE_URL}${DEFAULT_KLINE_PATH}`;
    try {
      const { data: cfgRow } = await db
        .from("app_settings")
        .select("value")
        .eq("key", "external_api_config")
        .maybeSingle();
      if (cfgRow?.value) {
        const cfg = cfgRow.value as { base_url?: string };
        if (cfg.base_url && /^https?:\/\/.+/.test(cfg.base_url)) {
          klineBaseUrl = `${cfg.base_url.replace(/\/$/, "")}${DEFAULT_KLINE_PATH}`;
        }
      }
    } catch (_) { /* use default */ }

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

    const now = Math.floor(Date.now() / 1000);
    // Only fetch last 2 minutes of 1m candles (current + previous)
    const from = now - 120;

    const results: LivePriceResult[] = [];

    // Process all products in parallel
    const tasks = products.map(async (product) => {
      let symbol = product.symbol;
      if (!symbol) {
        const name = product.name || "";
        if (name.toLowerCase().includes("wing") || name.toLowerCase().includes("wig")) {
          symbol = "WIG/USDT";
        } else {
          symbol = name.replace(/[^A-Za-z0-9]/g, "").substring(0, 6).toUpperCase() + "/USDT";
        }
      }

      try {
        const encodedSymbol = encodeURIComponent(symbol);
        const apiUrl = `${klineBaseUrl}?symbol=${encodedSymbol}&period=1min&size=2&from=${from}&to=${now}&zip=0`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        let response: Response;
        try {
          response = await fetch(apiUrl, {
            method: "GET",
            headers: { "Accept": "application/json", "User-Agent": "ST-Engineering-Live/1.0" },
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timeoutId);
        }

        if (!response.ok) {
          results.push({ productId: product.id, symbol, price: null, open: null, high: null, low: null, candleTime: null, success: false, error: `HTTP ${response.status}` });
          return;
        }

        const apiData: KlineApiResponse = await response.json();

        // Extract kline list
        let klineList: KlineItem[] = [];
        if (Array.isArray(apiData.data)) {
          klineList = apiData.data;
        } else if (apiData.data && typeof apiData.data === "object") {
          if ("data" in apiData.data && Array.isArray((apiData.data as { data?: KlineItem[] }).data)) {
            klineList = (apiData.data as { data: KlineItem[] }).data;
          } else if (apiData.data?.list && Array.isArray(apiData.data.list)) {
            klineList = apiData.data.list;
          }
        }

        if (klineList.length === 0) {
          results.push({ productId: product.id, symbol, price: null, open: null, high: null, low: null, candleTime: null, success: false, error: "No kline data" });
          return;
        }

        // Sort ascending, take most recent candle
        const sorted = klineList
          .map(item => {
            const ts = (item.ts ?? item.time ?? item.t ?? 0);
            return {
              ts,
              open: Number(item.open ?? item.o ?? 0),
              high: Number(item.high ?? item.h ?? 0),
              low: Number(item.low ?? item.l ?? 0),
              close: Number(item.close ?? item.c ?? 0),
            };
          })
          .filter(c => c.ts > 0 && (c.open > 0 || c.close > 0))
          .sort((a, b) => a.ts - b.ts);

        if (sorted.length === 0) {
          results.push({ productId: product.id, symbol, price: null, open: null, high: null, low: null, candleTime: null, success: false, error: "Empty after filter" });
          return;
        }

        const latest = sorted[sorted.length - 1];
        const candleTime = new Date(latest.ts * 1000).toISOString();
        const newPrice = latest.close;

        // 1. Update product.price in the products table
        const priceChanged = product.price === null || Math.abs((product.price as number) - newPrice) > 0.000001;
        if (priceChanged) {
          await db
            .from("products")
            .update({
              price: newPrice,
              updated_at: new Date().toISOString(),
            })
            .eq("id", product.id);
        }

        // 2. Upsert the running candle into price_history (current 1m candle)
        // This updates the currently open candle in real-time
        await db
          .from("price_history")
          .upsert({
            product_id: product.id,
            recorded_at: candleTime,
            open_price: latest.open,
            high_price: latest.high,
            low_price: latest.low,
            close_price: latest.close,
            volume: 0,
          }, {
            onConflict: "product_id,recorded_at",
            ignoreDuplicates: false, // Always update to trigger realtime
          });

        results.push({
          productId: product.id,
          symbol,
          price: newPrice,
          open: latest.open,
          high: latest.high,
          low: latest.low,
          candleTime,
          success: true,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        results.push({ productId: product.id, symbol, price: null, open: null, high: null, low: null, candleTime: null, success: false, error: msg });
      }
    });

    await Promise.all(tasks);

    const succeeded = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    console.log(`[sync-live-price] Done: ${succeeded} succeeded, ${failed} failed`);

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
