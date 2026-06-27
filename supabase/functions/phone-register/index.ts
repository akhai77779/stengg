import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { phone, password, fullName } = await req.json();
    if (!phone || !password || password.length < 6) {
      return new Response(
        JSON.stringify({ error: "Invalid phone or password" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, supabaseServiceKey);

    const normalizedPhone = phone.startsWith("+") ? phone : `+${phone}`;
    const phoneEmail = `${normalizedPhone.replace(/\+/g, "")}@phone.local`;

    const { data: existing } = await admin
      .from("profiles")
      .select("id")
      .eq("phone", normalizedPhone)
      .maybeSingle();
    if (existing) {
      return new Response(
        JSON.stringify({ error: "Phone already registered" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email: phoneEmail,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName || "", phone: normalizedPhone },
    });

    if (authError) {
      return new Response(
        JSON.stringify({ error: authError.message }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (authData.user) {
      await admin.from("profiles").update({ phone: normalizedPhone }).eq("id", authData.user.id);
    }

    return new Response(
      JSON.stringify({ success: true, email: phoneEmail }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});