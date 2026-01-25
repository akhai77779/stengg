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

interface PriceHistoryRecord {
  product_id: string;
  recorded_at: string;
  open_price: number;
  high_price: number;
  low_price: number;
  close_price: number;
  volume: number;
}

interface SyncStats {
  productsTotal: number;
  productsSynced: number;
  productsErrored: number;
  recordsInserted: number;
  recordsUpdated: number;
  apiCallsTotal: number;
  apiCallsFailed: number;
  startTime: number;
  endTime?: number;
}

// Fetch with exponential backoff retry
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = 3,
  delayMs = 500
): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
      
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok && attempt < retries) {
        console.warn(`[Attempt ${attempt}/${retries}] HTTP ${response.status} for ${url}`);
        await new Promise(resolve => setTimeout(resolve, delayMs * Math.pow(2, attempt - 1)));
        continue;
      }
      
      return response;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`[Attempt ${attempt}/${retries}] Fetch error:`, lastError.message);
      
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, delayMs * Math.pow(2, attempt - 1)));
      }
    }
  }
  
  throw lastError || new Error("Fetch failed after retries");
}

// Parse kline data from various response formats
function parseKlineList(apiData: KlineApiResponse): KlineItem[] {
  if (Array.isArray(apiData.data)) {
    return apiData.data;
  }
  
  if (apiData.data && typeof apiData.data === 'object') {
    if ('data' in apiData.data && Array.isArray((apiData.data as { data?: KlineItem[] }).data)) {
      return (apiData.data as { data: KlineItem[] }).data;
    }
    if (apiData.data?.list && Array.isArray(apiData.data.list)) {
      return apiData.data.list;
    }
  }
  
  return [];
}

// Convert kline item to price history record
function klineToRecord(item: KlineItem, productId: string): PriceHistoryRecord | null {
  const timestamp = item.ts ?? item.time ?? item.t ?? 0;
  if (timestamp === 0) return null;

  const open = Number(item.open ?? item.o ?? 0);
  const high = Number(item.high ?? item.h ?? 0);
  const low = Number(item.low ?? item.l ?? 0);
  const close = Number(item.close ?? item.c ?? 0);
  const volume = Number(item.vol ?? item.v ?? 0);

  if (open <= 0 && close <= 0) return null;

  return {
    product_id: productId,
    recorded_at: new Date(timestamp * 1000).toISOString(),
    open_price: open,
    high_price: high,
    low_price: low,
    close_price: close,
    volume: volume,
  };
}

// Batch upsert records with conflict handling
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function batchUpsertRecords(
  supabase: any,
  records: PriceHistoryRecord[]
): Promise<{ inserted: number; updated: number; errors: number }> {
  if (records.length === 0) {
    return { inserted: 0, updated: 0, errors: 0 };
  }

  // Deduplicate by (product_id, recorded_at) - keep latest
  const deduped = new Map<string, PriceHistoryRecord>();
  for (const record of records) {
    const key = `${record.product_id}_${record.recorded_at}`;
    deduped.set(key, record);
  }
  
  const uniqueRecords = Array.from(deduped.values());
  console.log(`[Batch] Upserting ${uniqueRecords.length} unique records (deduped from ${records.length})`);

  // Use upsert with onConflict to trigger UPDATE events for realtime
  const { data, error } = await supabase
    .from("price_history")
    .upsert(uniqueRecords, {
      onConflict: "product_id,recorded_at",
      ignoreDuplicates: false, // Important: trigger UPDATE for realtime
    })
    .select("id");

  if (error) {
    console.error("[Batch] Upsert error:", error.message);
    
    // Fallback: try individual inserts for failed batch
    let fallbackInserted = 0;
    let fallbackErrors = 0;
    
    for (const record of uniqueRecords) {
      const { error: insertError } = await supabase
        .from("price_history")
        .upsert(record, {
          onConflict: "product_id,recorded_at",
          ignoreDuplicates: false,
        });
      
      if (insertError) {
        fallbackErrors++;
      } else {
        fallbackInserted++;
      }
    }
    
    console.log(`[Batch Fallback] Inserted: ${fallbackInserted}, Errors: ${fallbackErrors}`);
    return { inserted: fallbackInserted, updated: 0, errors: fallbackErrors };
  }

  const count = data?.length || uniqueRecords.length;
  console.log(`[Batch] Successfully upserted ${count} records`);
  return { inserted: count, updated: 0, errors: 0 };
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const stats: SyncStats = {
    productsTotal: 0,
    productsSynced: 0,
    productsErrored: 0,
    recordsInserted: 0,
    recordsUpdated: 0,
    apiCallsTotal: 0,
    apiCallsFailed: 0,
    startTime: Date.now(),
  };

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY) {
      console.error("[Config] Missing Supabase credentials");
      return new Response(JSON.stringify({ error: "Server misconfigured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // JWT Authentication - require admin role
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.warn("[Auth] Missing or invalid Authorization header");
      return new Response(JSON.stringify({ error: "Unauthorized: Missing authentication" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create auth client to verify user
    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await authClient.auth.getUser();
    if (userError || !user) {
      console.warn("[Auth] Authentication failed:", userError?.message);
      return new Response(JSON.stringify({ error: "Unauthorized: Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify admin role
    const { data: roleData } = await authClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      console.warn(`[Auth] User ${user.id} attempted price sync without admin role`);
      return new Response(JSON.stringify({ error: "Forbidden: Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[Auth] Admin user ${user.id} initiated price sync`);

    // Parse optional request body
    let targetProductId: string | null = null;
    try {
      const body = await req.json();
      targetProductId = body?.productId || null;
    } catch {
      // No body or invalid JSON - sync all products
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Build query for products
    let query = supabase
      .from("products")
      .select("id, symbol, name")
      .eq("status", "available");
    
    if (targetProductId) {
      query = query.eq("id", targetProductId);
    }

    const { data: products, error: productsError } = await query;

    if (productsError || !products) {
      console.error("[DB] Failed to fetch products:", productsError?.message);
      return new Response(JSON.stringify({ error: "Failed to fetch products" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    stats.productsTotal = products.length;
    console.log(`[Sync] Starting sync for ${products.length} products`);

    const now = Math.floor(Date.now() / 1000);
    const from = now - 180; // Last 3 minutes for better coverage
    
    // Collect all records for batch upsert
    const allRecords: PriceHistoryRecord[] = [];
    const productErrors: string[] = [];

    for (const product of products) {
      try {
        // Determine symbol
        let symbol = product.symbol;
        if (!symbol) {
          const name = product.name || "";
          if (name.toLowerCase().includes("wing") || name.toLowerCase().includes("wig")) {
            symbol = "WIG/USDT";
          } else {
            symbol = name.replace(/[^A-Za-z0-9]/g, "").substring(0, 6).toUpperCase() + "/USDT";
          }
        }

        const encodedSymbol = encodeURIComponent(symbol);
        const apiUrl = `${EXTERNAL_KLINE_API_URL}?symbol=${encodedSymbol}&period=1min&size=3&from=${from}&to=${now}&zip=0`;

        stats.apiCallsTotal++;
        console.log(`[API] Fetching ${product.name} (${symbol})`);

        const response = await fetchWithRetry(apiUrl, {
          method: "GET",
          headers: {
            "Accept": "application/json",
            "User-Agent": "ST-Engineering-Sync/2.0",
          },
        }, 3, 300);

        if (!response.ok) {
          stats.apiCallsFailed++;
          console.warn(`[API] HTTP ${response.status} for ${product.name}`);
          productErrors.push(`${product.name}: HTTP ${response.status}`);
          continue;
        }

        const apiData: KlineApiResponse = await response.json();
        const klineList = parseKlineList(apiData);

        if (klineList.length === 0) {
          console.log(`[API] No candles for ${product.name}`);
          continue;
        }

        console.log(`[API] Got ${klineList.length} candles for ${product.name}`);

        // Convert to records
        for (const item of klineList) {
          const record = klineToRecord(item, product.id);
          if (record) {
            allRecords.push(record);
          }
        }

        stats.productsSynced++;
      } catch (productError) {
        stats.apiCallsFailed++;
        stats.productsErrored++;
        const errMsg = productError instanceof Error ? productError.message : String(productError);
        console.error(`[Error] ${product.name}:`, errMsg);
        productErrors.push(`${product.name}: ${errMsg}`);
      }
    }

    // Batch upsert all collected records
    if (allRecords.length > 0) {
      console.log(`[Batch] Total records to upsert: ${allRecords.length}`);
      const result = await batchUpsertRecords(supabase, allRecords);
      stats.recordsInserted = result.inserted;
      stats.recordsUpdated = result.updated;
    }

    stats.endTime = Date.now();
    const duration = stats.endTime - stats.startTime;

    console.log(`[Sync Complete] Duration: ${duration}ms`);
    console.log(`[Sync Stats] Products: ${stats.productsSynced}/${stats.productsTotal} synced, ${stats.productsErrored} errors`);
    console.log(`[Sync Stats] Records: ${stats.recordsInserted} inserted/updated`);
    console.log(`[Sync Stats] API calls: ${stats.apiCallsTotal} total, ${stats.apiCallsFailed} failed`);

    if (productErrors.length > 0) {
      console.log(`[Errors Summary] ${productErrors.join('; ')}`);
    }

    return new Response(JSON.stringify({ 
      success: true,
      stats: {
        duration: `${duration}ms`,
        products: {
          total: stats.productsTotal,
          synced: stats.productsSynced,
          errored: stats.productsErrored,
        },
        records: {
          inserted: stats.recordsInserted,
          updated: stats.recordsUpdated,
        },
        api: {
          calls: stats.apiCallsTotal,
          failed: stats.apiCallsFailed,
        },
      },
      errors: productErrors.length > 0 ? productErrors : undefined,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    stats.endTime = Date.now();
    const duration = stats.endTime - stats.startTime;
    const errMsg = e instanceof Error ? e.message : String(e);
    
    console.error(`[Fatal Error] After ${duration}ms:`, errMsg);
    
    return new Response(JSON.stringify({ 
      error: "Unexpected error",
      message: errMsg,
      stats: {
        duration: `${duration}ms`,
        products: {
          total: stats.productsTotal,
          synced: stats.productsSynced,
          errored: stats.productsErrored,
        },
      },
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
