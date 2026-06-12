import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ExpiredTrade {
  id: string;
  product_id: string;
  entry_price: number;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Authorization: only the cron job (using service role key) or an
    // explicit CRON_SECRET may invoke this function. Any other JWT is rejected.
    const cronSecret = Deno.env.get("CRON_SECRET");
    const authHeader = req.headers.get("Authorization") || "";
    const serviceRoleAuth = `Bearer ${supabaseServiceKey}`;
    const cronAuth = cronSecret ? `Bearer ${cronSecret}` : null;
    if (authHeader !== serviceRoleAuth && (!cronAuth || authHeader !== cronAuth)) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use service role key to bypass RLS
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("[settle-expired-trades] Starting auto-settle check...");

    // Find all active trades that have expired
    const { data: expiredTrades, error: fetchError } = await supabase
      .from("option_trades")
      .select("id, product_id, entry_price")
      .eq("status", "active")
      .lt("expires_at", new Date().toISOString());

    if (fetchError) {
      console.error("[settle-expired-trades] Error fetching expired trades:", fetchError);
      return new Response(
        JSON.stringify({ success: false, error: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!expiredTrades || expiredTrades.length === 0) {
      console.log("[settle-expired-trades] No expired trades found");
      return new Response(
        JSON.stringify({ success: true, message: "No expired trades", settled: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[settle-expired-trades] Found ${expiredTrades.length} expired trades`);

    // Get unique product IDs and fetch current prices
    const productIds = [...new Set(expiredTrades.map((t: ExpiredTrade) => t.product_id))];
    
    const { data: products, error: productsError } = await supabase
      .from("products")
      .select("id, price")
      .in("id", productIds);

    if (productsError) {
      console.error("[settle-expired-trades] Error fetching products:", productsError);
    }

    // Build price map
    const priceMap: Record<string, number> = {};
    products?.forEach((p: { id: string; price: number | null }) => {
      priceMap[p.id] = p.price ?? 0;
    });

    // Settle each expired trade
    let settledCount = 0;
    let errorCount = 0;
    const results: Array<{ trade_id: string; success: boolean; error?: string }> = [];

    for (const trade of expiredTrades as ExpiredTrade[]) {
      const exitPrice = priceMap[trade.product_id] || trade.entry_price;

      const { data: settleResult, error: settleError } = await supabase.rpc(
        "settle_option_trade",
        {
          _trade_id: trade.id,
          _exit_price: exitPrice,
        }
      );

      if (settleError) {
        console.error(`[settle-expired-trades] Failed to settle trade ${trade.id}:`, settleError);
        errorCount++;
        results.push({ trade_id: trade.id, success: false, error: settleError.message });
      } else {
        console.log(`[settle-expired-trades] Settled trade ${trade.id}:`, settleResult);
        settledCount++;
        results.push({ trade_id: trade.id, success: true });
      }
    }

    console.log(`[settle-expired-trades] Completed. Settled: ${settledCount}, Errors: ${errorCount}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Auto-settled ${settledCount} trades`,
        settled: settledCount,
        errors: errorCount,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[settle-expired-trades] Unexpected error:", error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
