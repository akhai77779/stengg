import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/telegram";

function escapeHtml(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const TELEGRAM_API_KEY = Deno.env.get("TELEGRAM_API_KEY");
    if (!TELEGRAM_API_KEY) throw new Error("TELEGRAM_API_KEY is not configured");

    const TELEGRAM_CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID");
    if (!TELEGRAM_CHAT_ID) throw new Error("TELEGRAM_CHAT_ID is not configured");

    const body = await req.json();
    const { type } = body;

    let text: string;

    if (type === "notification") {
      // System notification from DB trigger - no auth required
      const { title, message, notification_type, user_email } = body;
      if (!title || !message) {
        return new Response(JSON.stringify({ error: "Missing title or message" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const typeEmoji: Record<string, string> = {
        success: "✅",
        error: "❌",
        info: "ℹ️",
        warning: "⚠️",
      };
      const emoji = typeEmoji[notification_type] || "🔔";

      text = `${emoji} <b>${escapeHtml(title)}</b>\n\n💬 ${escapeHtml(message)}`;
      if (user_email) {
        text += `\n👤 <b>User:</b> ${escapeHtml(user_email)}`;
      }
    } else {
      // Live chat message - verify admin
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
      if (userErr || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: hasRole } = await supabase.rpc("has_role", {
        _user_id: user.id,
        _role: "admin",
      });
      if (!hasRole) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { sender_name, message, room_id } = body;
      if (!sender_name || !message) {
        return new Response(JSON.stringify({ error: "Missing sender_name or message" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      text = `💬 <b>Tin nhắn mới từ Live Chat</b>\n\n👤 <b>Khách hàng:</b> ${escapeHtml(sender_name)}\n💬 <b>Nội dung:</b> ${escapeHtml(message)}\n🆔 <b>Phòng:</b> ${escapeHtml(room_id || "N/A")}`;
    }

    console.log(`[telegram-notify] Sending to ${TELEGRAM_CHAT_ID}, type: ${type || "chat"}`);

    const response = await fetch(`${GATEWAY_URL}/sendMessage`, {
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

    const data = await response.json();
    if (!response.ok) {
      throw new Error(`Telegram API call failed [${response.status}]: ${JSON.stringify(data)}`);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error sending Telegram notification:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
