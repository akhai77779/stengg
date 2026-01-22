import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    console.log(`Fetching fund account for user_id: ${user_id}`);

    // Call external API
    const externalUrl = `https://admin.stenggg.com/api/app/user/fundAccount`;
    
    const response = await fetch(externalUrl, {
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

    const data = await response.json();
    console.log("External API response:", JSON.stringify(data));

    // Extract balance from response
    // Expected format: { code: 200, data: { balance: 1000, ... } }
    const balance = data?.data?.balance ?? null;
    const frozen = data?.data?.frozen ?? data?.data?.frozen_balance ?? 0;

    return new Response(
      JSON.stringify({
        success: true,
        balance,
        frozen,
        raw: data,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in fetch-fund-account:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
