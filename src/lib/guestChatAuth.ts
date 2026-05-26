import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY = "live_chat_guest_session";

export interface GuestChatSession {
  guest_id: string;
  token: string;
  room_id: string;
}

function applyHeaders(guest_id: string, token: string) {
  try {
    // PostgrestClient exposes a mutable `headers` object — mutate so
    // subsequent .from() calls include guest credentials in RLS checks.
    const rest = (supabase as unknown as { rest: { headers: Record<string, string> } }).rest;
    if (rest?.headers) {
      rest.headers["x-guest-id"] = guest_id;
      rest.headers["x-guest-token"] = token;
    }
    // Functions client also has headers (used by edge function invokes)
    const fns = (supabase as unknown as { functions: { headers?: Record<string, string> } })
      .functions;
    if (fns && fns.headers) {
      fns.headers["x-guest-id"] = guest_id;
      fns.headers["x-guest-token"] = token;
    }
  } catch (e) {
    console.warn("[guestChatAuth] failed to apply headers", e);
  }
}

export function clearGuestHeaders() {
  try {
    const rest = (supabase as unknown as { rest: { headers: Record<string, string> } }).rest;
    if (rest?.headers) {
      delete rest.headers["x-guest-id"];
      delete rest.headers["x-guest-token"];
    }
    const fns = (supabase as unknown as { functions: { headers?: Record<string, string> } })
      .functions;
    if (fns?.headers) {
      delete fns.headers["x-guest-id"];
      delete fns.headers["x-guest-token"];
    }
  } catch {
    /* noop */
  }
}

export function loadGuestSession(): GuestChatSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GuestChatSession;
    if (parsed?.guest_id && parsed?.token && parsed?.room_id) return parsed;
    return null;
  } catch {
    return null;
  }
}

export function saveGuestSession(session: GuestChatSession) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  applyHeaders(session.guest_id, session.token);
}

/**
 * Initialize (or resume) a guest chat session by calling the edge function,
 * which issues a fresh signed token. Always call this once per page load
 * before performing any guest chat operations.
 */
export async function initGuestSession(opts: {
  customer_name: string;
  customer_email?: string;
  topic?: string;
}): Promise<GuestChatSession> {
  const existing = loadGuestSession();
  const { data, error } = await supabase.functions.invoke("guest-chat-init", {
    body: {
      customer_name: opts.customer_name,
      customer_email: opts.customer_email,
      topic: opts.topic,
      guest_id: existing?.guest_id,
    },
  });
  if (error) throw error;
  if (!data?.ok) throw new Error(data?.error ?? "guest-chat-init failed");
  const session: GuestChatSession = {
    guest_id: data.guest_id,
    token: data.token,
    room_id: data.room.id,
  };
  saveGuestSession(session);
  return session;
}

/** Re-apply headers from stored session (e.g., on page reload). Returns whether headers were set. */
export function rehydrateGuestHeaders(): GuestChatSession | null {
  const s = loadGuestSession();
  if (s) applyHeaders(s.guest_id, s.token);
  return s;
}