import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function genToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function genGuestId(): string {
  return `guest_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const customer_name: string =
      typeof body.customer_name === "string" && body.customer_name.trim()
        ? body.customer_name.trim().slice(0, 80)
        : "Khách";
    const customer_email: string | null =
      typeof body.customer_email === "string" ? body.customer_email.slice(0, 200) : null;
    const existing_guest_id: string | undefined =
      typeof body.guest_id === "string" && body.guest_id.startsWith("guest_")
        ? body.guest_id
        : undefined;

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false },
    });

    // Always issue a fresh token on init for security.
    const guest_id = existing_guest_id ?? genGuestId();
    const token = genToken();
    const token_hash = await sha256Hex(token);

    // Look for an existing non-closed room for this guest_id
    const { data: existingRoom } = await supabase
      .from("live_chat_rooms")
      .select("*")
      .eq("customer_id", guest_id)
      .neq("status", "closed")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let room;
    if (existingRoom) {
      const { data: updated, error: updErr } = await supabase
        .from("live_chat_rooms")
        .update({
          guest_token_hash: token_hash,
          customer_name,
          customer_email,
          last_updated_at: new Date().toISOString(),
        })
        .eq("id", existingRoom.id)
        .select()
        .single();
      if (updErr) throw updErr;
      room = updated;
    } else {
      const { data: created, error: insErr } = await supabase
        .from("live_chat_rooms")
        .insert({
          customer_id: guest_id,
          customer_name,
          customer_email,
          status: "waiting",
          guest_token_hash: token_hash,
        })
        .select()
        .single();
      if (insErr) throw insErr;
      room = created;
    }

    return new Response(
      JSON.stringify({ ok: true, guest_id, token, room }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (e) {
    console.error("guest-chat-init error", e);
    return new Response(
      JSON.stringify({ ok: false, error: (e as Error).message ?? "unknown" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  }
});