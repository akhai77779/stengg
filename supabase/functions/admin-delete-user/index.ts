import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const admin = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing authorization" }, 401);

    const caller = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await caller.auth.getUser();
    if (userErr || !user) return json({ error: "Invalid session" }, 401);

    const { data: roleData } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleData) return json({ error: "Admin role required" }, 403);

    const { user_id: targetId } = await req.json();
    if (!targetId) return json({ error: "Missing user_id" }, 400);
    if (targetId === user.id) {
      return json({ success: false, error: "Không thể tự xóa tài khoản của mình" });
    }

    // Get target profile snapshot for audit
    const { data: targetProfile } = await admin
      .from("profiles")
      .select("id, full_name, email, phone, user_code, balance")
      .eq("id", targetId)
      .maybeSingle();

    if (!targetProfile) {
      return json({ success: false, error: "Không tìm thấy người dùng" });
    }

    // Block deletion if target is an admin
    const { data: targetRole } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", targetId)
      .eq("role", "admin")
      .maybeSingle();
    if (targetRole) {
      return json({ success: false, error: "Không thể xóa tài khoản admin khác" });
    }

    // Delete dependent rows that reference user_id (preserve audit_logs, transactions, option_trades for history)
    const cleanupTables = [
      "bank_accounts",
      "user_notifications",
      "admin_user_notes",
      "identity_verifications",
      "rate_limits",
      "user_savings_deposits",
      "user_roles",
    ];
    for (const t of cleanupTables) {
      const { error } = await admin.from(t).delete().eq("user_id", targetId);
      if (error) console.warn(`Cleanup ${t} failed:`, error.message);
    }

    // Delete profile row
    const { error: profileErr } = await admin.from("profiles").delete().eq("id", targetId);
    if (profileErr) {
      console.error("Delete profile failed:", profileErr);
      return json({ success: false, error: "Không thể xóa hồ sơ: " + profileErr.message });
    }

    // Delete auth user
    const { error: authDelErr } = await admin.auth.admin.deleteUser(targetId);
    if (authDelErr) {
      console.error("Delete auth user failed:", authDelErr);
      return json({ success: false, error: "Đã xóa hồ sơ nhưng không xóa được auth: " + authDelErr.message });
    }

    // Audit log
    await admin.from("audit_logs").insert({
      user_id: user.id,
      action: "admin_delete_user",
      entity_type: "profile",
      entity_id: targetId,
      details: {
        target_user_id: targetId,
        snapshot: targetProfile,
      },
    });

    return json({ success: true });
  } catch (e) {
    console.error("admin-delete-user error:", e);
    return json({ success: false, error: (e as Error).message || "Internal error" });
  }
});