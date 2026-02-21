/// <reference lib="deno.ns" />

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface PriceControl {
  product_id: string;
  direction: string;
  strength: number;
  is_active: boolean;
  expires_at: string | null;
}

interface SyncStats {
  productsTotal: number;
  productsSynced: number;
  productsErrored: number;
  recordsInserted: number;
  priceControlsApplied: number;
  startTime: number;
  endTime?: number;
}

/**
 * Generate a simulated price tick based on current price with momentum
 */
function generatePriceTick(
  currentPrice: number,
  control: PriceControl | null
): { open: number; high: number; low: number; close: number } {
  // Base random walk
  const volatility = 0.002; // 0.2% base volatility
  let change = (Math.random() - 0.5) * 2 * volatility;

  // Apply price control bias
  if (control) {
    const bias = control.direction === 'up' ? 1 : -1;
    const biasStrength = control.strength * 0.001 * (0.5 + Math.random() * 0.5);
    change += bias * biasStrength;
  }

  const close = currentPrice * (1 + change);
  const spread = currentPrice * volatility * 0.5;
  const high = Math.max(currentPrice, close) + Math.random() * spread;
  const low = Math.min(currentPrice, close) - Math.random() * spread;

  return {
    open: currentPrice,
    high,
    low,
    close,
  };
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
    priceControlsApplied: 0,
    startTime: Date.now(),
  };

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error("[Config] Missing credentials");
      return new Response(JSON.stringify({ error: "Server misconfigured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Optional auth check
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
    console.log("[Sync] Starting price sync (local generation)...");

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
      .select("id, symbol, name, price")
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

    // Build control map, auto-deactivate expired
    const controlMap = new Map<string, PriceControl>();
    if (priceControls) {
      const now = new Date();
      for (const ctrl of priceControls) {
        if (ctrl.expires_at && new Date(ctrl.expires_at) <= now) {
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
    const now = new Date().toISOString();

    for (const product of products) {
      try {
        const currentPrice = product.price || 100;
        const control = controlMap.get(product.id) || null;

        // Generate a new price tick
        const tick = generatePriceTick(currentPrice, control);

        if (control) {
          stats.priceControlsApplied++;
        }

        // Insert into price_history
        const { error: insertError } = await supabase
          .from("price_history")
          .upsert({
            product_id: product.id,
            recorded_at: now,
            open_price: tick.open,
            high_price: tick.high,
            low_price: tick.low,
            close_price: tick.close,
            volume: 0,
          }, { onConflict: "product_id,recorded_at" });

        if (insertError) {
          console.error(`[DB] Insert error for ${product.name}:`, insertError.message);
          stats.productsErrored++;
          continue;
        }

        // Update product's current price
        await supabase
          .from("products")
          .update({
            price: tick.close,
            high_24h: tick.high,
            low_24h: tick.low,
            updated_at: now,
          })
          .eq("id", product.id);

        stats.recordsInserted++;
        stats.productsSynced++;
      } catch (productError) {
        stats.productsErrored++;
        const errMsg = productError instanceof Error ? productError.message : String(productError);
        console.error(`[Error] ${product.name}: ${errMsg}`);
      }
    }

    stats.endTime = Date.now();
    const duration = stats.endTime - stats.startTime;

    console.log(`[Sync Complete] ${duration}ms | Products: ${stats.productsSynced}/${stats.productsTotal} | Records: ${stats.recordsInserted} | Controls: ${stats.priceControlsApplied}`);

    return new Response(JSON.stringify({ 
      success: true,
      stats: {
        duration: `${duration}ms`,
        products: { total: stats.productsTotal, synced: stats.productsSynced, errored: stats.productsErrored },
        records: { inserted: stats.recordsInserted },
        priceControls: { applied: stats.priceControlsApplied },
      },
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
