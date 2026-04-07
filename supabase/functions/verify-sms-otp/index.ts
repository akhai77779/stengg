import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { phone, code, password, fullName } = await req.json();

    if (!phone || !code || !password) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const normalizedPhone = phone.startsWith("+") ? phone : `+${phone}`;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find valid OTP
    const { data: otpRecord, error: findError } = await supabase
      .from("phone_otps")
      .select("*")
      .eq("phone", normalizedPhone)
      .eq("code", code)
      .eq("verified", false)
      .gte("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (findError || !otpRecord) {
      // Increment attempts on all unverified OTPs for this phone
      const { data: otps } = await supabase
        .from("phone_otps")
        .select("id, attempts")
        .eq("phone", normalizedPhone)
        .eq("verified", false);

      if (otps && otps.length > 0) {
        for (const otp of otps) {
          await supabase
            .from("phone_otps")
            .update({ attempts: otp.attempts + 1 })
            .eq("id", otp.id);

          // Lock out after 5 failed attempts
          if (otp.attempts + 1 >= 5) {
            await supabase
              .from("phone_otps")
              .delete()
              .eq("id", otp.id);
          }
        }
      }

      return new Response(
        JSON.stringify({ error: "Invalid or expired OTP code" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mark OTP as verified
    await supabase
      .from("phone_otps")
      .update({ verified: true })
      .eq("id", otpRecord.id);

    // Create user via Supabase Auth admin API
    // Generate a dummy email from phone for auth (phone as identifier)
    const phoneEmail = `${normalizedPhone.replace(/\+/g, "")}@phone.local`;

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: phoneEmail,
      password,
      email_confirm: true, // Auto-confirm since phone is already verified
      user_metadata: {
        full_name: fullName || otpRecord.full_name || "",
        phone: normalizedPhone,
      },
    });

    if (authError) {
      console.error("Auth create user error:", authError);
      
      // Check if user already exists
      if (authError.message?.includes("already been registered") || authError.message?.includes("already registered")) {
        return new Response(
          JSON.stringify({ error: "Phone number already registered" }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: authError.message || "Failed to create account" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update profile with phone number
    if (authData.user) {
      await supabase
        .from("profiles")
        .update({ phone: normalizedPhone })
        .eq("id", authData.user.id);
    }

    // Clean up used OTPs for this phone
    await supabase
      .from("phone_otps")
      .delete()
      .eq("phone", normalizedPhone);

    // Sign in the user to get a session
    const { data: signInData, error: signInError } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email: phoneEmail,
    });

    return new Response(
      JSON.stringify({
        success: true,
        user: authData.user,
        email: phoneEmail,
        message: "Account created successfully",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("verify-sms-otp error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
