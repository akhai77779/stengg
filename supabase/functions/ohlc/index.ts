/// <reference lib="deno.ns" />

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Timeframe = "1m" | "30m" | "1h" | "1d";

type OhlcRow = {
  recorded_at: string;
  open_price: string | number;
  high_price: string | number;
  low_price: string | number;
  close_price: string | number;
};

type Bucket = {
  bucketStartSec: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

function timeframeToSeconds(tf: Timeframe): number {
  switch (tf) {
    case "1m":
      return 60;
    case "30m":
      return 30 * 60;
    case "1h":
      return 60 * 60;
    case "1d":
      return 24 * 60 * 60;
  }
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function toSec(iso: string): number {
  return Math.floor(new Date(iso).getTime() / 1000);
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

    const bucketSec = timeframeToSeconds(timeframe);
    const limit = clamp(Math.floor(limitRaw), 50, 500);

    let endDate = cursor ? new Date(cursor) : new Date();
    if (Number.isNaN(endDate.getTime())) {
      return new Response(JSON.stringify({ error: "Invalid cursor" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If the dataset is historical (no recent rows), default to the latest available point
    // so the chart still renders.
    if (!cursor) {
      const { data: latest, error: latestErr } = await supabase
        .from("price_history")
        .select("recorded_at")
        .eq("product_id", productId)
        .order("recorded_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestErr) {
        console.error("latest price_history query error", latestErr);
      }
      if (latest?.recorded_at) {
        endDate = new Date(latest.recorded_at);
      }
    }

    // Fetch enough raw rows to aggregate into `limit` buckets.
    // We over-fetch to handle sparse data (e.g., hourly samples for 1m buckets).
    const startDate = new Date(endDate.getTime() - bucketSec * limit * 1000);
    const fromIso = startDate.toISOString();
    const toIso = endDate.toISOString();

    const { data: rows, error: rowsError } = await supabase
      .from("price_history")
      .select("recorded_at,open_price,high_price,low_price,close_price")
      .eq("product_id", productId)
      .gte("recorded_at", fromIso)
      .lte("recorded_at", toIso)
      .order("recorded_at", { ascending: true })
      .limit(5000);

    if (rowsError) {
      console.error("price_history query error", rowsError);
      return new Response(JSON.stringify({ error: "Failed to load price history" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const buckets = new Map<number, Bucket>();
    for (const r of (rows ?? []) as OhlcRow[]) {
      const tSec = toSec(r.recorded_at);
      const bucketStartSec = Math.floor(tSec / bucketSec) * bucketSec;
      const open = Number(r.open_price);
      const high = Number(r.high_price);
      const low = Number(r.low_price);
      const close = Number(r.close_price);

      const existing = buckets.get(bucketStartSec);
      if (!existing) {
        buckets.set(bucketStartSec, { bucketStartSec, open, high, low, close });
      } else {
        existing.high = Math.max(existing.high, high);
        existing.low = Math.min(existing.low, low);
        existing.close = close;
      }
    }

    const candles = Array.from(buckets.values())
      .sort((a, b) => a.bucketStartSec - b.bucketStartSec)
      .slice(-limit)
      .map((b) => ({
        time: new Date(b.bucketStartSec * 1000).toISOString(),
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
      }));

    const nextCursor = startDate.toISOString();

    return new Response(JSON.stringify({ candles, nextCursor }), {
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
