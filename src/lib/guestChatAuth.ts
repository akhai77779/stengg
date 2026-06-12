import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY = "live_chat_guest_session";

export interface GuestChatSession {
  guest_id: string;
  token: string;
  room_id: string;
}

function setHeader(h: unknown, key: string, value: string) {
  if (!h) return;
  if (typeof (h as Headers).set === "function") {
    (h as Headers).set(key, value);
  } else {
    (h as Record<string, string>)[key] = value;
  }
}

function deleteHeader(h: unknown, key: string) {
  if (!h) return;
  if (typeof (h as Headers).delete === "function") {
    (h as Headers).delete(key);
  } else {
    delete (h as Record<string, string>)[key];
  }
}

function applyHeaders(guest_id: string, token: string) {
  try {
    const rest = (supabase as unknown as { rest?: { headers?: unknown } }).rest;
    setHeader(rest?.headers, "x-guest-id", guest_id);
    setHeader(rest?.headers, "x-guest-token", token);

    // Also mutate the SupabaseClient-level headers (passed by reference to
    // realtime/storage/functions/rest). Plain Record<string,string>.
    const top = (supabase as unknown as { headers?: Record<string, string> }).headers;
    if (top) {
      top["x-guest-id"] = guest_id;
      top["x-guest-token"] = token;
    }

    const fns = (supabase as unknown as { functions?: { headers?: unknown } }).functions;
    setHeader(fns?.headers, "x-guest-id", guest_id);
    setHeader(fns?.headers, "x-guest-token", token);
  } catch (e) {
    console.warn("[guestChatAuth] failed to apply headers", e);
  }
}

export function clearGuestHeaders() {
  try {
    const rest = (supabase as unknown as { rest?: { headers?: unknown } }).rest;
    deleteHeader(rest?.headers, "x-guest-id");
    deleteHeader(rest?.headers, "x-guest-token");
    const top = (supabase as unknown as { headers?: Record<string, string> }).headers;
    if (top) {
      delete top["x-guest-id"];
      delete top["x-guest-token"];
    }
    const fns = (supabase as unknown as { functions?: { headers?: unknown } }).functions;
    deleteHeader(fns?.headers, "x-guest-id");
    deleteHeader(fns?.headers, "x-guest-token");
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