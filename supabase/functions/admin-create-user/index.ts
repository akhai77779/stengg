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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Verify admin role from JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify the calling user is admin
    const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller }, error: callerError } = await callerClient.auth.getUser();
    if (callerError || !caller) {
      return new Response(
        JSON.stringify({ error: "Invalid session" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check admin role
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: Admin role required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { method, fullName, email, phone, password } = await req.json();

    // Validate inputs
    if (!method || !fullName || !password) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: method, fullName, password" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (password.length < 6) {
      return new Response(
        JSON.stringify({ error: "Password must be at least 6 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let userEmail: string;
    let normalizedPhone: string | null = null;

    if (method === "phone") {
      if (!phone) {
        return new Response(
          JSON.stringify({ error: "Phone number is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      normalizedPhone = phone.startsWith("+") ? phone : `+${phone}`;
      userEmail = `${normalizedPhone.replace(/\+/g, "")}@phone.local`;
    } else if (method === "email") {
      if (!email) {
        return new Response(
          JSON.stringify({ error: "Email is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      userEmail = email;
    } else {
      return new Response(
        JSON.stringify({ error: "Invalid method. Use 'email' or 'phone'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create user via admin API
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: userEmail,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        ...(normalizedPhone ? { phone: normalizedPhone } : {}),
      },
    });

    if (authError) {
      console.error("Create user error:", authError);
      if (authError.message?.includes("already") || authError.message?.includes("registered")) {
        return new Response(
          JSON.stringify({ error: "User already exists with this email/phone", fallback: true }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ error: authError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update profile with phone if phone method
    if (authData.user && normalizedPhone) {
      await supabaseAdmin
        .from("profiles")
        .update({ phone: normalizedPhone })
        .eq("id", authData.user.id);
    }

    // Audit log
    await supabaseAdmin.from("audit_logs").insert({
      user_id: caller.id,
      action: "admin_create_user",
      entity_type: "profile",
      entity_id: authData.user?.id,
      details: {
        method,
        email: userEmail,
        phone: normalizedPhone,
        full_name: fullName,
        created_by_admin: caller.id,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        user_id: authData.user?.id,
        email: userEmail,
        message: "User created successfully",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("admin-create-user error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
