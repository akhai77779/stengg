import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Allowed origins for CORS - restrict to known domains
const ALLOWED_ORIGINS = [
  "https://stengg-it-com.lovable.app",
  "https://id-preview--f9a00261-b7fb-4428-ad85-88f8d5788c27.lovable.app",
  "http://localhost:5173",
  "http://localhost:8080",
];

function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

serve(async (req) => {
  const origin = req.headers.get("Origin");
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Validate origin for actual requests (not just preflight)
  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    console.warn(`Rejected request from unauthorized origin: ${origin}`);
    return new Response(
      JSON.stringify({ success: false, error: "Origin not allowed" }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
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

    // Get API token from secrets
    const apiToken = Deno.env.get("EXTERNAL_API_TOKEN");
    
    let balance: number | null = null;
    let frozen: number | null = null;
    let source = "database"; // Track where balance came from

    // Try external API first if token is available
    if (apiToken) {
      try {
        const externalUrl = `https://admin.stenggg.com/api/app/user/fundAccount`;
        
        const response = await fetch(externalUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Authorization": `Bearer ${apiToken}`,
            "token": apiToken, // Some APIs use this header
          },
          body: JSON.stringify({ user_id }),
        });

        if (response.ok) {
          const data = await response.json();
          console.log("External API response:", JSON.stringify(data));

          // Check if API returned success
          if (data?.code === 200 || data?.result_code === "SUCCESS") {
            balance = data?.data?.balance ?? null;
            frozen = data?.data?.frozen ?? data?.data?.frozen_balance ?? 0;
            source = "external_api";
            console.log(`External API success: balance=${balance}, frozen=${frozen}`);
          } else {
            console.log(`External API returned error: ${data?.message || 'Unknown error'}`);
          }
        } else {
          console.error(`External API HTTP error: ${response.status}`);
        }
      } catch (apiError) {
        console.error("External API error:", apiError);
      }
    } else {
      console.log("No EXTERNAL_API_TOKEN configured, using database fallback");
    }

    // Fallback to database if external API failed or no token
    if (balance === null) {
      console.log("Falling back to database for balance");
      
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      const { data: profile, error: dbError } = await supabase
        .from("profiles")
        .select("balance")
        .eq("id", user_id)
        .maybeSingle();

      if (dbError) {
        console.error("Database error:", dbError);
        return new Response(
          JSON.stringify({ success: false, error: "Failed to fetch balance" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (profile) {
        balance = profile.balance ?? 0;
        frozen = 0; // Database doesn't have frozen balance
        source = "database";
        console.log(`Database fallback: balance=${balance}`);
      } else {
        balance = 0;
        frozen = 0;
        console.log("No profile found, defaulting to 0");
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        balance,
        frozen,
        source,
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
