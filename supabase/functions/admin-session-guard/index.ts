import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const jsonHeaders = {
  ...corsHeaders,
  "Content-Type": "application/json",
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  "Pragma": "no-cache",
  "Vary": "Authorization",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "GET" && req.method !== "POST") {
    return new Response(JSON.stringify({ allowed: false, error: "Method not allowed" }), {
      status: 405,
      headers: jsonHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      return new Response(JSON.stringify({ allowed: false, error: "Server configuration missing" }), {
        status: 500,
        headers: jsonHeaders,
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ allowed: false, error: "Unauthorized" }), {
        status: 401,
        headers: jsonHeaders,
      });
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    const { data: userData, error: userError } = await userClient.auth.getUser();
    const user = userData?.user;

    if (userError || !user) {
      return new Response(JSON.stringify({ allowed: false, error: "Invalid session" }), {
        status: 401,
        headers: jsonHeaders,
      });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    const { data: isAdmin, error: roleError } = await adminClient.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });

    if (roleError) {
      console.error("Admin guard role check failed:", roleError);
      return new Response(JSON.stringify({ allowed: false, error: "Role check failed" }), {
        status: 500,
        headers: jsonHeaders,
      });
    }

    if (isAdmin !== true) {
      return new Response(JSON.stringify({ allowed: false, error: "Admin role required" }), {
        status: 403,
        headers: jsonHeaders,
      });
    }

    return new Response(JSON.stringify({ allowed: true }), {
      status: 200,
      headers: jsonHeaders,
    });
  } catch (error) {
    console.error("Admin session guard error:", error);
    return new Response(JSON.stringify({ allowed: false, error: "Internal server error" }), {
      status: 500,
      headers: jsonHeaders,
    });
  }
});
