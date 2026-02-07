import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BankQuayCallback {
  // BankQuay webhook payload structure
  id?: string;
  transaction_id?: string;
  amount: number;
  content: string; // Transfer content/memo
  bank_account?: string;
  bank_name?: string;
  sender_name?: string;
  sender_account?: string;
  timestamp?: string;
  type?: string; // "in" for deposit
  signature?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const bankQuayApiKey = Deno.env.get("BANKQUAY_API_KEY");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse webhook payload
    const payload: BankQuayCallback = await req.json();
    console.log("BankQuay webhook received:", JSON.stringify(payload));

    // Validate required fields
    if (!payload.amount || !payload.content) {
      console.error("Missing required fields in webhook payload");
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Only process incoming transactions (deposits)
    if (payload.type && payload.type !== "in") {
      console.log("Ignoring non-deposit transaction type:", payload.type);
      return new Response(
        JSON.stringify({ success: true, message: "Ignored non-deposit transaction" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract transaction reference from content (e.g., "NAP1234567890" or user code)
    const content = payload.content.toUpperCase().trim();
    console.log("Processing transfer content:", content);

    // Try to match by NAP prefix (auto-generated from deposit page)
    const napMatch = content.match(/NAP(\d+)/);
    
    // Try to match by user code
    const userCodeMatch = content.match(/(\d{6,10})/);

    let userId: string | null = null;

    // First try to find pending transaction by content pattern
    if (napMatch) {
      console.log("Looking for pending transaction with NAP reference");
      
      // Find recent pending deposit that might match this amount
      const { data: pendingTx, error: txError } = await supabase
        .from("transactions")
        .select("id, user_id, amount, notes")
        .eq("type", "deposit")
        .eq("status", "pending")
        .eq("amount", payload.amount)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (pendingTx && !txError) {
        userId = pendingTx.user_id;
        console.log("Found pending transaction for user:", userId);
        
        // Auto-approve this pending transaction
        const { error: approveError } = await supabase
          .from("transactions")
          .update({
            status: "approved",
            notes: `Auto-approved via BankQuay. Ref: ${payload.transaction_id || 'N/A'}. Sender: ${payload.sender_name || 'N/A'}`,
            updated_at: new Date().toISOString(),
          })
          .eq("id", pendingTx.id);

        if (approveError) {
          console.error("Error approving transaction:", approveError);
        }
      }
    }

    // If no pending transaction found, try to find user by user_code
    if (!userId && userCodeMatch) {
      const possibleCode = parseInt(userCodeMatch[1], 10);
      console.log("Looking for user with code:", possibleCode);

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, user_code")
        .eq("user_code", possibleCode)
        .maybeSingle();

      if (profile && !profileError) {
        userId = profile.id;
        console.log("Found user by code:", userId);
      }
    }

    if (!userId) {
      console.log("Could not identify user from transfer content:", content);
      
      // Log unmatched transaction for manual review
      await supabase.from("audit_logs").insert({
        user_id: "00000000-0000-0000-0000-000000000000", // System user placeholder
        action: "bankquay_unmatched",
        entity_type: "deposit",
        details: {
          amount: payload.amount,
          content: payload.content,
          sender_name: payload.sender_name,
          sender_account: payload.sender_account,
          bank_name: payload.bank_name,
          timestamp: payload.timestamp,
          transaction_id: payload.transaction_id,
        },
      });

      return new Response(
        JSON.stringify({ success: true, message: "Transaction logged for manual review" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get current balance
    const { data: currentProfile, error: balanceError } = await supabase
      .from("profiles")
      .select("balance")
      .eq("id", userId)
      .single();

    if (balanceError || !currentProfile) {
      console.error("Error fetching user balance:", balanceError);
      return new Response(
        JSON.stringify({ success: false, error: "User not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const currentBalance = currentProfile.balance || 0;
    const newBalance = currentBalance + payload.amount;

    // Update user balance
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        balance: newBalance,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (updateError) {
      console.error("Error updating balance:", updateError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to update balance" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create transaction record if not already matched
    const { error: txCreateError } = await supabase.from("transactions").insert({
      user_id: userId,
      type: "deposit",
      amount: payload.amount,
      status: "approved",
      notes: `Auto-deposit via BankQuay. Sender: ${payload.sender_name || 'N/A'}. Account: ${payload.sender_account || 'N/A'}`,
      tx_hash: payload.transaction_id || null,
    });

    if (txCreateError) {
      console.error("Error creating transaction:", txCreateError);
    }

    // Create audit log
    await supabase.from("audit_logs").insert({
      user_id: userId,
      action: "bankquay_auto_deposit",
      entity_type: "deposit",
      details: {
        amount: payload.amount,
        content: payload.content,
        sender_name: payload.sender_name,
        sender_account: payload.sender_account,
        bank_name: payload.bank_name,
        balance_before: currentBalance,
        balance_after: newBalance,
        bankquay_tx_id: payload.transaction_id,
      },
    });

    // Send notification to user
    await supabase.from("user_notifications").insert({
      user_id: userId,
      title: "💰 Nạp tiền thành công",
      message: `Đã nhận ${payload.amount.toLocaleString()} VND từ ${payload.sender_name || 'Chuyển khoản ngân hàng'}`,
      type: "success",
      metadata: {
        amount: payload.amount,
        sender: payload.sender_name,
        auto_deposit: true,
      },
    });

    console.log(`Successfully processed deposit of ${payload.amount} for user ${userId}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Deposit processed successfully",
        user_id: userId,
        amount: payload.amount,
        new_balance: newBalance,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error processing BankQuay webhook:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
