import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify admin from auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin role
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ success: false, error: "Admin only" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { audit_log_id, user_id } = await req.json();

    if (!audit_log_id || !user_id) {
      return new Response(JSON.stringify({ success: false, error: "Missing audit_log_id or user_id" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get the unmatched audit log
    const { data: logEntry, error: logError } = await supabase
      .from("audit_logs")
      .select("*")
      .eq("id", audit_log_id)
      .eq("action", "bankquay_unmatched")
      .single();

    if (logError || !logEntry) {
      return new Response(JSON.stringify({ success: false, error: "Audit log not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const details = logEntry.details as Record<string, unknown>;
    const amount = Number(details?.amount || 0);

    if (amount <= 0) {
      return new Response(JSON.stringify({ success: false, error: "Invalid amount" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get current user balance
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("balance")
      .eq("id", user_id)
      .single();

    if (profileError || !profile) {
      return new Response(JSON.stringify({ success: false, error: "User not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const currentBalance = profile.balance || 0;
    const newBalance = currentBalance + amount;

    // Update balance
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ balance: newBalance, updated_at: new Date().toISOString() })
      .eq("id", user_id);

    if (updateError) {
      return new Response(JSON.stringify({ success: false, error: "Failed to update balance" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create approved transaction
    await supabase.from("transactions").insert({
      user_id,
      type: "deposit",
      amount,
      status: "approved",
      notes: `Manual match by admin. Sender: ${details?.sender_name || "N/A"}. Content: ${details?.content || "N/A"}`,
      tx_hash: (details?.transaction_id as string) || null,
    });

    // Log the manual match
    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: "bankquay_manual_match",
      entity_type: "deposit",
      entity_id: audit_log_id,
      details: {
        matched_user_id: user_id,
        amount,
        original_content: details?.content,
        sender_name: details?.sender_name,
        balance_before: currentBalance,
        balance_after: newBalance,
      },
    });

    // Send notification to user
    await supabase.from("user_notifications").insert({
      user_id,
      title: "💰 Nạp tiền thành công",
      message: `Đã nhận ${amount.toLocaleString()} VND từ ${details?.sender_name || "Chuyển khoản ngân hàng"} (xử lý thủ công)`,
      type: "success",
      metadata: { amount, manual_match: true },
    });

    return new Response(
      JSON.stringify({ success: true, amount, new_balance: newBalance }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
