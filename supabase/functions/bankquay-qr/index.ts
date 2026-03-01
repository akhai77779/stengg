import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Validate origin for actual requests
  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    console.warn(`Rejected request from unauthorized origin: ${origin}`);
    return new Response(
      JSON.stringify({ error: "Origin not allowed" }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const { amount, addinfo, apiKey } = await req.json();

    if (!amount || !apiKey) {
      return new Response(
        JSON.stringify({ error: "Missing required parameters: amount and apiKey" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch QR image from BankQuay API
    const bankQuayUrl = `http://api.bankquay.com/${apiKey}?amount=${amount}&addinfo=${addinfo || ''}`;
    
    const response = await fetch(bankQuayUrl);
    
    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: `BankQuay API error: ${response.status}` }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the image as array buffer
    const imageBuffer = await response.arrayBuffer();
    const contentType = response.headers.get("content-type") || "image/png";

    return new Response(imageBuffer, {
      headers: {
        ...corsHeaders,
        "Content-Type": contentType,
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    console.error("Error proxying BankQuay:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
