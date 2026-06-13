import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/telegram";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const MAX_ATTEMPTS = 5;
const BATCH_SIZE = 20;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const TELEGRAM_API_KEY = Deno.env.get("TELEGRAM_API_KEY");
    const TELEGRAM_CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Auth: cron-only function — require service role or CRON_SECRET bearer
    const cronSecret = Deno.env.get("CRON_SECRET");
    const authHeader = req.headers.get("Authorization") || "";
    const allowed =
      authHeader === `Bearer ${SERVICE_KEY}` ||
      (!!cronSecret && authHeader === `Bearer ${cronSecret}`);
    if (!allowed) {
      return new Response(
        JSON.stringify({ ok: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!LOVABLE_API_KEY || !TELEGRAM_API_KEY || !TELEGRAM_CHAT_ID) {
      return new Response(
        JSON.stringify({ ok: false, error: "Telegram secrets not configured" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // Fetch pending or failed (with attempts < max) rows
    const { data: rows, error: fetchErr } = await supabase
      .from("telegram_outbox")
      .select("id, payload, attempts, status")
      .in("status", ["pending", "failed"])
      .lt("attempts", MAX_ATTEMPTS)
      .order("created_at", { ascending: true })
      .limit(BATCH_SIZE);

    if (fetchErr) throw fetchErr;
    if (!rows || rows.length === 0) {
      return new Response(JSON.stringify({ ok: true, processed: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let sent = 0;
    let failed = 0;

    for (const row of rows) {
      const p = row.payload as Record<string, unknown>;
      const title = String(p.title ?? "");
      const message = String(p.message ?? "");
      const ntype = String(p.notification_type ?? "info");
      const userEmail = p.user_email ? String(p.user_email) : null;

      const emojiMap: Record<string, string> = {
        success: "✅",
        error: "❌",
        info: "ℹ️",
        warning: "⚠️",
      };
      const emoji = emojiMap[ntype] || "🔔";
      let text = `${emoji} <b>${escapeHtml(title)}</b>\n\n💬 ${escapeHtml(message)}`;
      if (userEmail) text += `\n👤 <b>User:</b> ${escapeHtml(userEmail)}`;

      try {
        const resp = await fetch(`${GATEWAY_URL}/sendMessage`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "X-Connection-Api-Key": TELEGRAM_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            chat_id: TELEGRAM_CHAT_ID,
            text,
            parse_mode: "HTML",
          }),
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok) {
          throw new Error(`Telegram ${resp.status}: ${JSON.stringify(data)}`);
        }
        await supabase
          .from("telegram_outbox")
          .update({
            status: "sent",
            attempts: row.attempts + 1,
            sent_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            last_error: null,
          })
          .eq("id", row.id);
        sent++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const newAttempts = row.attempts + 1;
        await supabase
          .from("telegram_outbox")
          .update({
            status: newAttempts >= MAX_ATTEMPTS ? "failed" : "pending",
            attempts: newAttempts,
            last_error: msg.slice(0, 500),
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id);
        failed++;
        console.error(`[process-telegram-outbox] id=${row.id} failed: ${msg}`);
      }
    }

    return new Response(JSON.stringify({ ok: true, processed: rows.length, sent, failed }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[process-telegram-outbox] fatal:", msg);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}