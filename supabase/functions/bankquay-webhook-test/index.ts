import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { amount, content, sender_name, user_code } = await req.json();

    if (!amount) {
      return new Response(
        JSON.stringify({ error: "amount is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build simulated BankQuay payload
    const payload: Record<string, unknown> = {
      id: crypto.randomUUID(),
      transaction_id: `TEST_${Date.now()}`,
      amount: Number(amount),
      content: content || (user_code ? `NAP${Date.now()} ${user_code}` : `NAP${Date.now()}`),
      bank_account: "TEST_ACCOUNT",
      bank_name: "TEST_BANK",
      sender_name: sender_name || "Test Sender",
      sender_account: "9999999999",
      timestamp: new Date().toISOString(),
      type: "in",
    };

    const rawBody = JSON.stringify(payload);

    // Sign with webhook secret
    const webhookSecret = Deno.env.get("BANKQUAY_WEBHOOK_SECRET") || "";
    let signature = "";

    if (webhookSecret) {
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(webhookSecret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
      );
      const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
      signature = Array.from(new Uint8Array(sig))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    }

    // Call the real webhook endpoint
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const webhookUrl = `${supabaseUrl}/functions/v1/bankquay-webhook`;

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(signature ? { "x-bankquay-signature": signature } : {}),
      },
      body: rawBody,
    });

    const result = await response.json();

    return new Response(
      JSON.stringify({
        test: true,
        simulated_payload: payload,
        signature_used: !!signature,
        webhook_status: response.status,
        webhook_response: result,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
