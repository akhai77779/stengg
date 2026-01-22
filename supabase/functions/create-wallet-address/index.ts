import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EXTERNAL_API_URL = "https://admin.stenggg.com/api/app/user/createWalletAddress";

interface WalletApiResponse {
  code?: number;
  message?: string;
  data?: {
    address?: string;
    bep20?: string;
    trc20?: string;
    erc20?: string;
    wallet_address?: string;
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user_id } = await req.json();

    if (!user_id) {
      return new Response(
        JSON.stringify({ success: false, error: "user_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Creating wallet address for user_id: ${user_id}`);

    // Call external API
    const response = await fetch(EXTERNAL_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({ user_id }),
    });

    if (!response.ok) {
      console.error(`External API error: ${response.status}`);
      return new Response(
        JSON.stringify({ success: false, error: `External API returned ${response.status}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data: WalletApiResponse = await response.json();
    console.log("External API response:", JSON.stringify(data));

    // Extract wallet addresses from response
    const walletData = data?.data;
    const bep20 = walletData?.bep20 || walletData?.address || null;
    const trc20 = walletData?.trc20 || null;
    const erc20 = walletData?.erc20 || null;

    // If we have wallet addresses, save them to the database
    if (bep20 || trc20 || erc20) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      const updateData: Record<string, string | null> = {};
      if (bep20) updateData.wallet_address_bep20 = bep20;
      if (trc20) updateData.wallet_address_trc20 = trc20;
      if (erc20) updateData.wallet_address_erc20 = erc20;

      const { error: updateError } = await supabase
        .from("profiles")
        .update(updateData)
        .eq("id", user_id);

      if (updateError) {
        console.error("Error saving wallet addresses:", updateError);
        return new Response(
          JSON.stringify({
            success: false,
            error: "Failed to save wallet addresses to database",
            addresses: { bep20, trc20, erc20 },
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`Saved wallet addresses for user ${user_id}`);

      // Log audit
      try {
        await supabase.from("audit_logs").insert({
          user_id,
          action: "wallet_address_created",
          entity_type: "profile",
          entity_id: user_id,
          details: { bep20, trc20, erc20 },
        });
      } catch {
        // Ignore audit log errors
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        addresses: { bep20, trc20, erc20 },
        raw: data,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in create-wallet-address:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
