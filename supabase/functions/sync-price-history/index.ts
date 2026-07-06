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

function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function isServiceRoleJwt(token: string, envKey: string | undefined): boolean {
  if (!token) return false;
  if (envKey && token === envKey) return true;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return false;
    const payloadB64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = payloadB64 + "=".repeat((4 - (payloadB64.length % 4)) % 4);
    const json = JSON.parse(atob(padded));
    return json?.role === "service_role";
  } catch {
    return false;
  }
}

function currentMinuteIso(): string {
  const d = new Date();
  d.setSeconds(0, 0);
  return d.toISOString();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function upsertCandlesFromProducts(supabase: any) {
  const { data: products, error } = await supabase
    .from("products")
    .select("id, price")
    .eq("status", "available");

  if (error || !products) {
    throw new Error(`Failed to fetch products: ${error?.message ?? "unknown"}`);
  }

  const bucket = currentMinuteIso();
  const productIds = products.map((p: { id: string }) => p.id);

  // Fetch existing candles for this minute (if any)
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
      const tickVolume = 1000 + Math.floor(Math.random() * 4000);
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

  if (records.length === 0) {
    return { inserted: 0, updated: 0, total: products.length };
  }

  const { error: upsertError } = await supabase
    .from("price_history")
    .upsert(records, { onConflict: "product_id,recorded_at", ignoreDuplicates: false });

  if (upsertError) {
    throw new Error(`Upsert failed: ${upsertError.message}`);
  }

  const updated = records.filter((r: { product_id: string }) => existingMap.has(r.product_id)).length;
  return {
    inserted: records.length - updated,
    updated,
    total: products.length,
  };
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

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY) {
      return new Response(JSON.stringify({ error: "Server misconfigured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    const cronHeader = req.headers.get("x-cron-secret") || "";
    const cronSecretEnv = Deno.env.get("CRON_SECRET");
    const isCronHeader = !!cronSecretEnv && cronHeader === cronSecretEnv;

    if (!isCronHeader && (!authHeader || !authHeader.startsWith("Bearer "))) {
      return new Response(JSON.stringify({ error: "Unauthorized: Missing authentication" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const bearer = authHeader ? authHeader.slice("Bearer ".length).trim() : "";
    const isServiceRole = !!bearer && isServiceRoleJwt(bearer, SUPABASE_SERVICE_ROLE_KEY);
    const isCronBearer = !!cronSecretEnv && bearer === cronSecretEnv;

    if (!isServiceRole && !isCronBearer && !isCronHeader) {
      // Verify admin user
      const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user }, error: userError } = await authClient.auth.getUser();
      if (userError || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized: Invalid token" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: roleData } = await authClient
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      if (!roleData) {
        return new Response(JSON.stringify({ error: "Forbidden: Admin access required" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.log(`[Auth] Admin user ${user.id} invoked sync`);
    } else {
      console.log(
        isCronHeader ? "[Auth] Cron header invocation" :
        isCronBearer ? "[Auth] Cron-secret invocation" :
        "[Auth] Service-role invocation (cron)"
      );
    }

    const started = Date.now();
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const result = await upsertCandlesFromProducts(supabase);
    const duration = Date.now() - started;

    console.log(`[Sync] products=${result.total} inserted=${result.inserted} updated=${result.updated} in ${duration}ms`);

    return new Response(JSON.stringify({
      success: true,
      stats: { duration: `${duration}ms`, ...result },
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[Fatal]", msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});