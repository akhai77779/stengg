import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { phone, fullName } = await req.json();

    // Capture caller IP (best-effort) for IP-level rate limiting.
    const ipAddress =
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-real-ip") ||
      (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() ||
      null;

    if (!phone || typeof phone !== "string" || phone.length < 8) {
      return new Response(
        JSON.stringify({ error: "Invalid phone number" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Normalize phone (ensure E.164 format)
    const normalizedPhone = phone.startsWith("+") ? phone : `+${phone}`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY");
    if (!TWILIO_API_KEY) throw new Error("TWILIO_API_KEY is not configured");

    const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER");
    if (!TWILIO_PHONE_NUMBER) throw new Error("TWILIO_PHONE_NUMBER is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Rate limit: max 3 OTPs per phone per 5 minutes
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from("phone_otps")
      .select("*", { count: "exact", head: true })
      .eq("phone", normalizedPhone)
      .gte("created_at", fiveMinAgo);

    if ((count ?? 0) >= 3) {
      return new Response(
        JSON.stringify({ error: "Too many OTP requests. Please wait." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // IP-level rate limit: max 10 OTP requests per IP per hour to mitigate SMS bombing.
    if (ipAddress) {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count: ipCount } = await supabase
        .from("phone_otps")
        .select("*", { count: "exact", head: true })
        .eq("ip_address", ipAddress)
        .gte("created_at", oneHourAgo);
      if ((ipCount ?? 0) >= 10) {
        return new Response(
          JSON.stringify({ error: "Too many OTP requests from this network. Please wait." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Generate 6-digit OTP using a CSPRNG
    const _rand = new Uint32Array(1);
    crypto.getRandomValues(_rand);
    const code = String(100000 + (_rand[0] % 900000)).padStart(6, "0");
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min

    // Store OTP
    const { error: insertError } = await supabase.from("phone_otps").insert({
      phone: normalizedPhone,
      code,
      full_name: fullName || null,
      expires_at: expiresAt,
      ip_address: ipAddress,
    });

    if (insertError) {
      console.error("Insert OTP error:", insertError);
      throw new Error("Failed to store OTP");
    }

    // Send SMS via Twilio gateway
    const smsResponse = await fetch(`${GATEWAY_URL}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": TWILIO_API_KEY,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: normalizedPhone,
        From: TWILIO_PHONE_NUMBER,
        Body: `[ST Engineering] Mã xác thực của bạn là: ${code}. Mã có hiệu lực trong 10 phút. Không chia sẻ mã này với bất kỳ ai.`,
      }),
    });

    const smsData = await smsResponse.json();

    if (!smsResponse.ok) {
      console.error("Twilio error:", JSON.stringify(smsData));
      // Clean up the OTP if SMS failed
      await supabase
        .from("phone_otps")
        .delete()
        .eq("phone", normalizedPhone)
        .eq("code", code);
      
      // Provide user-friendly error based on Twilio error code
      let userError = "Failed to send SMS. Please try again.";
      if (smsData?.code === 63038 || smsData?.message?.includes("daily messages limit")) {
        userError = "Hệ thống SMS đang quá tải. Vui lòng thử lại sau.";
      } else if (smsData?.code === 21608 || smsData?.message?.includes("unverified")) {
        userError = "Số điện thoại chưa được xác minh trong hệ thống.";
      }

      return new Response(
        JSON.stringify({ error: userError }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("SMS sent successfully:", smsData.sid);

    return new Response(
      JSON.stringify({ success: true, message: "OTP sent" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("send-sms-otp error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
