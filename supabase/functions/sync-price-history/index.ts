/// <reference lib="deno.ns" />

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const EXTERNAL_KLINE_API_URL = "https://admin.stenggg.com/api/app/option/getKline";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface KlineItem {
  ts?: number;
  time?: number;
  t?: number;
  open?: number | string;
  high?: number | string;
  low?: number | string;
  close?: number | string;
  vol?: number | string;
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
    data?: KlineItem[];
  };
}

// Fetch with retry for resilience
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
        await new Promise(resolve => setTimeout(resolve, delayMs * Math.pow(2, i)));
      }
    }
  }
  
  throw lastError || new Error("Fetch failed after retries");
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error("Missing Supabase credentials");
      return new Response(JSON.stringify({ error: "Server misconfigured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role key to bypass RLS for inserts
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get all active products
    const { data: products, error: productsError } = await supabase
      .from("products")
      .select("id, symbol, name")
      .eq("status", "available");

    if (productsError || !products) {
      console.error("Failed to fetch products:", productsError);
      return new Response(JSON.stringify({ error: "Failed to fetch products" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Syncing price history for ${products.length} products`);

    const now = Math.floor(Date.now() / 1000);
    const from = now - 120; // Last 2 minutes
    let syncedCount = 0;
    let insertedCount = 0;

    for (const product of products) {
      try {
        // Determine symbol
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
        const apiUrl = `${EXTERNAL_KLINE_API_URL}?symbol=${encodedSymbol}&period=1min&size=2&from=${from}&to=${now}&zip=0`;

        const response = await fetchWithRetry(apiUrl, {
          method: "GET",
          headers: {
            "Accept": "application/json",
            "User-Agent": "ST-Engineering-Sync/1.0",
          },
        }, 2, 200);

        if (!response.ok) {
          console.warn(`API error for ${product.name}: ${response.status}`);
          continue;
        }

        const apiData: KlineApiResponse = await response.json();
        
        // Extract kline data
        let klineList: KlineItem[] = [];
        if (Array.isArray(apiData.data)) {
          klineList = apiData.data;
        } else if (apiData.data && typeof apiData.data === 'object') {
          if ('data' in apiData.data && Array.isArray((apiData.data as { data?: KlineItem[] }).data)) {
            klineList = (apiData.data as { data: KlineItem[] }).data;
          } else if (apiData.data?.list && Array.isArray(apiData.data.list)) {
            klineList = apiData.data.list;
          }
        }

        if (klineList.length === 0) {
          continue;
        }

        // Convert and insert price history
        for (const item of klineList) {
          const timestamp = item.ts ?? item.time ?? item.t ?? 0;
          if (timestamp === 0) continue;

          const open = Number(item.open ?? item.o ?? 0);
          const high = Number(item.high ?? item.h ?? 0);
          const low = Number(item.low ?? item.l ?? 0);
          const close = Number(item.close ?? item.c ?? 0);
          const volume = Number(item.vol ?? item.v ?? 0);

          if (open <= 0 && close <= 0) continue;

          const recordedAt = new Date(timestamp * 1000).toISOString();

          // Upsert with update on conflict to trigger realtime UPDATE events
          const { error: insertError } = await supabase
            .from("price_history")
            .upsert({
              product_id: product.id,
              recorded_at: recordedAt,
              open_price: open,
              high_price: high,
              low_price: low,
              close_price: close,
              volume: volume,
            }, {
              onConflict: "product_id,recorded_at",
              ignoreDuplicates: false,
            });

          if (insertError) {
            // Try insert without upsert if conflict constraint doesn't exist
            const { error: plainInsertError } = await supabase
              .from("price_history")
              .insert({
                product_id: product.id,
                recorded_at: recordedAt,
                open_price: open,
                high_price: high,
                low_price: low,
                close_price: close,
                volume: volume,
              });
            
            if (!plainInsertError) {
              insertedCount++;
            }
          } else {
            insertedCount++;
          }
        }

        syncedCount++;
      } catch (productError) {
        console.error(`Error syncing ${product.name}:`, productError);
      }
    }

    console.log(`Synced ${syncedCount} products, inserted ${insertedCount} price records`);

    return new Response(JSON.stringify({ 
      success: true, 
      syncedProducts: syncedCount,
      insertedRecords: insertedCount 
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("sync-price-history error:", e);
    return new Response(JSON.stringify({ error: "Unexpected error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
