import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-bankquay-signature",
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

// Verify HMAC-SHA256 signature from BankQuay
async function verifySignature(payload: string, signature: string, secret: string): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    
    const signatureBytes = await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(payload)
    );
    
    // Convert to hex string
    const expectedSignature = Array.from(new Uint8Array(signatureBytes))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    // Constant-time comparison to prevent timing attacks
    if (expectedSignature.length !== signature.toLowerCase().length) {
      return false;
    }
    
    let result = 0;
    for (let i = 0; i < expectedSignature.length; i++) {
      result |= expectedSignature.charCodeAt(i) ^ signature.toLowerCase().charCodeAt(i);
    }
    
    return result === 0;
  } catch (error) {
    console.error("Signature verification error:", error);
    return false;
  }
}
// In-memory rate limiter (per isolate instance)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 30; // max requests per window
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  
  entry.count++;
  if (entry.count > RATE_LIMIT_MAX) {
    return false;
  }
  return true;
}

// Cleanup stale entries periodically
function cleanupRateLimits() {
  const now = Date.now();
  for (const [key, value] of rateLimitMap.entries()) {
    if (now > value.resetAt) rateLimitMap.delete(key);
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Rate limiting by IP
    const clientIp = req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for") || "unknown";
    
    // Periodic cleanup (1% chance)
    if (Math.random() < 0.01) cleanupRateLimits();
    
    if (!checkRateLimit(clientIp)) {
      console.error(`Rate limit exceeded for IP: ${clientIp}`);
      return new Response(
        JSON.stringify({ success: false, error: "Too many requests" }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "60" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const webhookSecret = Deno.env.get("BANKQUAY_WEBHOOK_SECRET");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get raw body for signature verification
    const rawBody = await req.text();
    
    // Verify signature from header
    const signatureHeader = req.headers.get("x-bankquay-signature") || req.headers.get("X-BankQuay-Signature");
    
    if (webhookSecret && webhookSecret.length > 0) {
      if (!signatureHeader) {
        console.error("Missing signature header");
        return new Response(
          JSON.stringify({ success: false, error: "Missing signature" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      const isValid = await verifySignature(rawBody, signatureHeader, webhookSecret);
      
      if (!isValid) {
        console.error("Invalid signature");
        // Log failed signature attempt for security monitoring
        await supabase.from("audit_logs").insert({
          user_id: "00000000-0000-0000-0000-000000000000",
          action: "bankquay_invalid_signature",
          entity_type: "webhook",
          details: {
            signature_provided: signatureHeader.substring(0, 20) + "...",
            ip: req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for"),
            user_agent: req.headers.get("user-agent"),
          },
        });
        
        return new Response(
          JSON.stringify({ success: false, error: "Invalid signature" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      console.log("Signature verified successfully");
    } else {
      console.warn("BANKQUAY_WEBHOOK_SECRET not configured - signature verification skipped");
    }

    // Parse webhook payload from raw body
    const payload: BankQuayCallback = JSON.parse(rawBody);
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
