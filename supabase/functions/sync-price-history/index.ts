/// <reference lib="deno.ns" />

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const EXTERNAL_KLINE_API_URL = "https://admin.stenggg.com/api/app/option/getKline";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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
  priceControlsApplied: number;
  startTime: number;
  endTime?: number;
}

interface PriceControl {
  product_id: string;
  direction: string;
  strength: number;
  is_active: boolean;
  expires_at: string | null;
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
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
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

function parseKlineList(apiData: KlineApiResponse): KlineItem[] {
  if (Array.isArray(apiData.data)) return apiData.data;
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

/**
 * Apply price control bias to a record.
 * direction: 'up' or 'down'
 * strength: 1-10 (multiplier for bias)
 */
function applyPriceControl(record: PriceHistoryRecord, control: PriceControl): PriceHistoryRecord {
  const bias = control.direction === 'up' ? 1 : -1;
  // Base manipulation: 0.1% to 1% per candle depending on strength
  const factor = 1 + bias * (control.strength * 0.001) * (0.5 + Math.random() * 0.5);
  
  return {
    ...record,
    open_price: record.open_price * factor,
    high_price: record.high_price * (control.direction === 'up' ? factor * (1 + Math.random() * 0.001) : factor),
    low_price: record.low_price * (control.direction === 'down' ? factor * (1 - Math.random() * 0.001) : factor),
    close_price: record.close_price * factor,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function batchUpsertRecords(
  supabase: any,
  records: PriceHistoryRecord[]
): Promise<{ inserted: number; updated: number; errors: number }> {
  if (records.length === 0) return { inserted: 0, updated: 0, errors: 0 };

  const deduped = new Map<string, PriceHistoryRecord>();
  for (const record of records) {
    const key = `${record.product_id}_${record.recorded_at}`;
    deduped.set(key, record);
  }
  
  const uniqueRecords = Array.from(deduped.values());
  console.log(`[Batch] Upserting ${uniqueRecords.length} unique records (deduped from ${records.length})`);

  const { data, error } = await supabase
    .from("price_history")
    .upsert(uniqueRecords, {
      onConflict: "product_id,recorded_at",
      ignoreDuplicates: false,
    })
    .select("id");

  if (error) {
    console.error("[Batch] Upsert error:", error.message);
    
    let fallbackInserted = 0;
    let fallbackErrors = 0;
    
    for (const record of uniqueRecords) {
      const { error: insertError } = await supabase
        .from("price_history")
        .upsert(record, { onConflict: "product_id,recorded_at", ignoreDuplicates: false });
      
      if (insertError) fallbackErrors++;
      else fallbackInserted++;
    }
    
    return { inserted: fallbackInserted, updated: 0, errors: fallbackErrors };
  }

  const count = data?.length || uniqueRecords.length;
  return { inserted: count, updated: 0, errors: 0 };
}

Deno.serve(async (req) => {
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
    priceControlsApplied: 0,
    startTime: Date.now(),
  };

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error("[Config] Missing Supabase credentials");
      return new Response(JSON.stringify({ error: "Server misconfigured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role client (this function is called by cron or admin)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Optional auth check - allow both cron (no auth) and admin calls
    const authHeader = req.headers.get("Authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
      if (SUPABASE_ANON_KEY) {
        const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          global: { headers: { Authorization: authHeader } }
        });
        const { data: { user } } = await authClient.auth.getUser();
        if (user) {
          console.log(`[Auth] Request from user ${user.id}`);
        }
      }
    }
    console.log("[Sync] Starting price sync...");

    // Parse optional request body
    let targetProductId: string | null = null;
    try {
      const body = await req.json();
      targetProductId = body?.productId || null;
    } catch {
      // No body - sync all
    }

    // Fetch products
    let query = supabase
      .from("products")
      .select("id, symbol, name")
      .eq("status", "available");
    
    if (targetProductId) query = query.eq("id", targetProductId);

    const { data: products, error: productsError } = await query;

    if (productsError || !products) {
      console.error("[DB] Failed to fetch products:", productsError?.message);
      return new Response(JSON.stringify({ error: "Failed to fetch products" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch active price controls
    const { data: priceControls } = await supabase
      .from("product_price_controls")
      .select("product_id, direction, strength, is_active, expires_at")
      .eq("is_active", true);

    // Build a map of active, non-expired controls
    const controlMap = new Map<string, PriceControl>();
    if (priceControls) {
      const now = new Date();
      for (const ctrl of priceControls) {
        // Check if expired
        if (ctrl.expires_at && new Date(ctrl.expires_at) <= now) {
          // Auto-deactivate expired controls
          await supabase
            .from("product_price_controls")
            .update({ is_active: false, direction: 'neutral', strength: 1, expires_at: null })
            .eq("product_id", ctrl.product_id);
          console.log(`[PriceControl] Auto-deactivated expired control for ${ctrl.product_id}`);
          continue;
        }
        controlMap.set(ctrl.product_id, ctrl as PriceControl);
      }
    }
    console.log(`[PriceControl] ${controlMap.size} active price controls found`);

    stats.productsTotal = products.length;

    const now = Math.floor(Date.now() / 1000);
    const from = now - 180;
    
    const allRecords: PriceHistoryRecord[] = [];
    const productErrors: string[] = [];

    for (const product of products) {
      try {
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

        const response = await fetchWithRetry(apiUrl, {
          method: "GET",
          headers: {
            "Accept": "application/json",
            "User-Agent": "ST-Engineering-Sync/2.0",
          },
        }, 3, 300);

        if (!response.ok) {
          stats.apiCallsFailed++;
          productErrors.push(`${product.name}: HTTP ${response.status}`);
          continue;
        }

        const apiData: KlineApiResponse = await response.json();
        const klineList = parseKlineList(apiData);

        if (klineList.length === 0) continue;

        const control = controlMap.get(product.id);

        for (const item of klineList) {
          let record = klineToRecord(item, product.id);
          if (!record) continue;

          // Apply price control bias if active for this product
          if (control) {
            record = applyPriceControl(record, control);
            stats.priceControlsApplied++;
          }

          allRecords.push(record);
        }

        // If price control is active, also update the product's current price with bias
        if (control && klineList.length > 0) {
          const lastRecord = allRecords[allRecords.length - 1];
          if (lastRecord && lastRecord.product_id === product.id) {
            await supabase
              .from("products")
              .update({ price: lastRecord.close_price, updated_at: new Date().toISOString() })
              .eq("id", product.id);
            console.log(`[PriceControl] Updated ${product.name} price to ${lastRecord.close_price} (${control.direction} x${control.strength})`);
          }
        }

        stats.productsSynced++;
      } catch (productError) {
        stats.apiCallsFailed++;
        stats.productsErrored++;
        const errMsg = productError instanceof Error ? productError.message : String(productError);
        productErrors.push(`${product.name}: ${errMsg}`);
      }
    }

    // Batch upsert
    if (allRecords.length > 0) {
      const result = await batchUpsertRecords(supabase, allRecords);
      stats.recordsInserted = result.inserted;
      stats.recordsUpdated = result.updated;
    }

    stats.endTime = Date.now();
    const duration = stats.endTime - stats.startTime;

    console.log(`[Sync Complete] ${duration}ms | Products: ${stats.productsSynced}/${stats.productsTotal} | Records: ${stats.recordsInserted} | Controls: ${stats.priceControlsApplied}`);

    return new Response(JSON.stringify({ 
      success: true,
      stats: {
        duration: `${duration}ms`,
        products: { total: stats.productsTotal, synced: stats.productsSynced, errored: stats.productsErrored },
        records: { inserted: stats.recordsInserted, updated: stats.recordsUpdated },
        api: { calls: stats.apiCallsTotal, failed: stats.apiCallsFailed },
        priceControls: { applied: stats.priceControlsApplied },
      },
      errors: productErrors.length > 0 ? productErrors : undefined,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    stats.endTime = Date.now();
    const errMsg = e instanceof Error ? e.message : String(e);
    console.error(`[Fatal Error]`, errMsg);
    
    return new Response(JSON.stringify({ error: "Unexpected error", message: errMsg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
