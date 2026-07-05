/// <reference lib="deno.ns" />

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CYCLE_DELAY_MS = 5000;
const DEFAULT_CYCLES = 10;

function currentMinuteIso(): string {
  const d = new Date();
  d.setSeconds(0, 0);
  return d.toISOString();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function tickCandles(supabase: any) {
  const { data: products, error } = await supabase
    .from("products")
    .select("id, price")
    .eq("status", "available");

  if (error || !products || products.length === 0) return 0;

  const bucket = currentMinuteIso();
  const productIds = products.map((p: { id: string }) => p.id);

  const { data: existing } = await supabase
    .from("price_history")
    .select("product_id, open_price, high_price, low_price, volume")
    .in("product_id", productIds)
    .eq("recorded_at", bucket);

  const existingMap = new Map<string, { open_price: number; high_price: number; low_price: number; volume: number }>();
  for (const row of existing ?? []) {
    existingMap.set(row.product_id, {
      open_price: Number(row.open_price),
      high_price: Number(row.high_price),
      low_price: Number(row.low_price),
      volume: Number(row.volume),
    });
  }

  const records = products
    .filter((p: { price: number | null }) => p.price != null && Number(p.price) > 0)
    .map((p: { id: string; price: number }) => {
      const price = Number(p.price);
      const prev = existingMap.get(p.id);
      const tickVolume = 200 + Math.floor(Math.random() * 800);
      if (prev) {
        return {
          product_id: p.id,
          recorded_at: bucket,
          open_price: prev.open_price,
          high_price: Math.max(prev.high_price, price),
          low_price: Math.min(prev.low_price, price),
          close_price: price,
          volume: prev.volume + tickVolume,
        };
      }
      return {
        product_id: p.id,
        recorded_at: bucket,
        open_price: price,
        high_price: price,
        low_price: price,
        close_price: price,
        volume: tickVolume,
      };
    });

  if (records.length === 0) return 0;

  const { error: upsertError } = await supabase
    .from("price_history")
    .upsert(records, { onConflict: "product_id,recorded_at", ignoreDuplicates: false });

  if (upsertError) throw new Error(upsertError.message);
  return records.length;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*" } });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ success: false, error: "missing_config" }), { status: 200 });
    }

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
    const summary = { cycles, records: 0, errors: 0 };

    for (let i = 0; i < cycles; i++) {
      try {
        summary.records += await tickCandles(supabase);
      } catch (e) {
        summary.errors++;
        console.warn("[Tick error]", e instanceof Error ? e.message : String(e));
      }
      if (i < cycles - 1) await new Promise(r => setTimeout(r, CYCLE_DELAY_MS));
    }

    console.log(`[LiveSync] cycles=${summary.cycles} records=${summary.records} errors=${summary.errors}`);
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