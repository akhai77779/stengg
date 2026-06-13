/// <reference lib="deno.ns" />

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const EXTERNAL_KLINE_API_URL = "https://admin.stenggg.com/api/app/option/getKline";
const CYCLE_DELAY_MS = 5000;
const DEFAULT_CYCLES = 10;

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
  data?: KlineItem[] | { list?: KlineItem[]; data?: KlineItem[] };
}

interface ProductRow {
  id: string;
  name: string | null;
  symbol: string | null;
}

function parseKlineList(apiData: KlineApiResponse): KlineItem[] {
  if (Array.isArray(apiData.data)) return apiData.data;
  if (apiData.data && typeof apiData.data === "object") {
    if (Array.isArray(apiData.data.data)) return apiData.data.data;
    if (Array.isArray(apiData.data.list)) return apiData.data.list;
  }
  return [];
}

function itemToRecord(item: KlineItem, productId: string) {
  const timestamp = Number(item.ts ?? item.time ?? item.t ?? 0);
  const open = Number(item.open ?? item.o ?? 0);
  const high = Number(item.high ?? item.h ?? 0);
  const low = Number(item.low ?? item.l ?? 0);
  const close = Number(item.close ?? item.c ?? 0);
  const volume = Number(item.vol ?? item.v ?? 0);

  if (!timestamp || !Number.isFinite(close) || close <= 0) return null;

  return {
    product_id: productId,
    recorded_at: new Date(timestamp * 1000).toISOString(),
    open_price: open || close,
    high_price: high || close,
    low_price: low || close,
    close_price: close,
    volume: Number.isFinite(volume) ? volume : 0,
  };
}

async function fetchProductCandles(product: ProductRow) {
  const symbol = product.symbol || `${(product.name || "STENGG").replace(/[^A-Za-z0-9]/g, "").slice(0, 6).toUpperCase()}/USDT`;
  const now = Math.floor(Date.now() / 1000);
  const from = now - 180;
  const url = `${EXTERNAL_KLINE_API_URL}?symbol=${encodeURIComponent(symbol)}&period=1min&size=3&from=${from}&to=${now}&zip=0`;
  const response = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "ST-Engineering-Live-Sync/1.0" },
  });

  if (!response.ok) return [];
  const apiData = await response.json() as KlineApiResponse;
  return parseKlineList(apiData).map(item => itemToRecord(item, product.id)).filter(Boolean);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: { "Access-Control-Allow-Origin": "*" } });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ success: false, error: "missing_config" }), { status: 200 });
    }

    // Auth: cron-only function — require service role or CRON_SECRET bearer
    const cronSecret = Deno.env.get("CRON_SECRET");
    const authHeader = req.headers.get("Authorization") || "";
    const allowed =
      authHeader === `Bearer ${serviceRoleKey}` ||
      (!!cronSecret && authHeader === `Bearer ${cronSecret}`);
    if (!allowed) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401,
        headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const cycles = Math.max(1, Math.min(Number(body?.cycles ?? DEFAULT_CYCLES), DEFAULT_CYCLES));
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const summary = { cycles, records: 0, productUpdates: 0, errors: 0 };

    for (let cycle = 0; cycle < cycles; cycle++) {
      const { data: products, error } = await supabase
        .from("products")
        .select("id, name, symbol")
        .eq("status", "available");

      if (error || !products) {
        summary.errors++;
      } else {
        const batches = await Promise.allSettled((products as ProductRow[]).map(fetchProductCandles));
        const records = batches.flatMap(result => result.status === "fulfilled" ? result.value : []);
        summary.errors += batches.filter(result => result.status === "rejected").length;

        if (records.length > 0) {
          const { error: upsertError } = await supabase
            .from("price_history")
            .upsert(records, { onConflict: "product_id,recorded_at", ignoreDuplicates: false });

          if (upsertError) {
            summary.errors++;
          } else {
            summary.records += records.length;
            const latestByProduct = new Map<string, typeof records[number]>();
            for (const record of records) latestByProduct.set(record.product_id, record);

            await Promise.all(Array.from(latestByProduct.values()).map(async (record) => {
              const recent = records.filter(item => item.product_id === record.product_id);
              const first = recent[0]?.open_price || record.close_price;
              const high = Math.max(...recent.map(item => item.high_price));
              const low = Math.min(...recent.map(item => item.low_price));
              const priceChange = first > 0 ? ((record.close_price - first) / first) * 100 : 0;
              const { error: productError } = await supabase
                .from("products")
                .update({
                  price: record.close_price,
                  high_24h: high,
                  low_24h: low,
                  price_change: Math.round(priceChange * 100) / 100,
                  updated_at: new Date().toISOString(),
                })
                .eq("id", record.product_id);
              if (productError) summary.errors++; else summary.productUpdates++;
            }));
          }
        }
      }

      if (cycle < cycles - 1) await new Promise(resolve => setTimeout(resolve, CYCLE_DELAY_MS));
    }

    return new Response(JSON.stringify({ success: true, summary }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
});