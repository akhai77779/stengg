import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * These tests verify the multi-account session storage behavior used by
 * SwitchAccount.tsx. The component cannot be rendered in isolation easily
 * (it depends on AuthProvider, Router, Language context, etc.), so we
 * re-implement the same snapshot/restore primitives here against a mocked
 * Supabase client and assert that:
 *
 *   1. Adding a new account preserves the previous account's tokens.
 *   2. Switching back to the previous account restores its session via
 *      setSession() — no re-login required.
 *   3. Switching repeatedly between two accounts never drops either token.
 */

interface SavedAccount {
  email: string;
  lastLogin: string;
  accessToken?: string;
  refreshToken?: string;
  userId?: string;
}

interface FakeSession {
  access_token: string;
  refresh_token: string;
  user: { id: string; email: string };
}

// ---------- Fake Supabase ----------
function createFakeSupabase(initialSession: FakeSession | null = null) {
  let current: FakeSession | null = initialSession;
  // Map of refreshToken -> session it can restore (simulates server-side validity)
  const validRefreshTokens = new Map<string, FakeSession>();
  if (initialSession) validRefreshTokens.set(initialSession.refresh_token, initialSession);

  return {
    _internal: {
      registerSession(s: FakeSession) {
        validRefreshTokens.set(s.refresh_token, s);
      },
      invalidate(refreshToken: string) {
        validRefreshTokens.delete(refreshToken);
      },
      get current() {
        return current;
      },
    },
    auth: {
      async getSession() {
        return { data: { session: current } };
      },
      async setSession({ access_token, refresh_token }: { access_token: string; refresh_token: string }) {
        const found = validRefreshTokens.get(refresh_token);
        if (!found) {
          return { data: { session: null }, error: new Error("Invalid refresh token") };
        }
        current = { ...found, access_token };
        return { data: { session: current }, error: null };
      },
      async signOut() {
        current = null;
        return { error: null };
      },
      // Helper to simulate signIn by directly setting the session
      async _signInAs(session: FakeSession) {
        current = session;
        validRefreshTokens.set(session.refresh_token, session);
        return { data: { session }, error: null };
      },
    },
  };
}

// ---------- Logic under test (mirrors SwitchAccount.tsx) ----------
function readAccounts(): SavedAccount[] {
  try {
    const raw = localStorage.getItem("savedAccounts");
    return raw ? (JSON.parse(raw) as SavedAccount[]) : [];
  } catch {
    return [];
  }
}

function persistAccounts(list: SavedAccount[]) {
  localStorage.setItem("savedAccounts", JSON.stringify(list));
}

async function snapshotCurrentSession(supabase: ReturnType<typeof createFakeSupabase>) {
  const { data } = await supabase.auth.getSession();
  const session = data.session;
  if (!session?.user?.email) return;
  const current = readAccounts();
  const filtered = current.filter((a) => a.email !== session.user.email);
  const entry: SavedAccount = {
    email: session.user.email,
    lastLogin: new Date().toISOString(),
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    userId: session.user.id,
  };
  persistAccounts([entry, ...filtered]);
}

async function switchToAccount(
  supabase: ReturnType<typeof createFakeSupabase>,
  account: SavedAccount,
) {
  await snapshotCurrentSession(supabase);
  if (!account.refreshToken || !account.accessToken) {
    return { ok: false, reason: "needs-login" as const };
  }
  const { data, error } = await supabase.auth.setSession({
    access_token: account.accessToken,
    refresh_token: account.refreshToken,
  });
  if (error || !data.session) {
    return { ok: false, reason: "expired" as const };
  }
  const refreshed = data.session;
  const accounts = readAccounts().filter((a) => a.email !== account.email);
  persistAccounts([
    {
      email: account.email,
      lastLogin: new Date().toISOString(),
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token,
      userId: refreshed.user.id,
    },
    ...accounts,
  ]);
  return { ok: true as const };
}

async function addAccount(
  supabase: ReturnType<typeof createFakeSupabase>,
  newSession: FakeSession,
) {
  // 1) snapshot current
  await snapshotCurrentSession(supabase);
  // 2) sign out
  await supabase.auth.signOut();
  // 3) sign in as new account
  await supabase.auth._signInAs(newSession);
  // 4) snapshot new
  await snapshotCurrentSession(supabase);
}

// ---------- Tests ----------
describe("Multi-account session switching", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useRealTimers();
  });

  const sessionA: FakeSession = {
    access_token: "access-A-1",
    refresh_token: "refresh-A-1",
    user: { id: "user-a", email: "a@example.com" },
  };
  const sessionB: FakeSession = {
    access_token: "access-B-1",
    refresh_token: "refresh-B-1",
    user: { id: "user-b", email: "b@example.com" },
  };

  it("snapshots the current session on demand", async () => {
    const supabase = createFakeSupabase(sessionA);
    await snapshotCurrentSession(supabase);
    const saved = readAccounts();
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({
      email: "a@example.com",
      accessToken: "access-A-1",
      refreshToken: "refresh-A-1",
      userId: "user-a",
    });
  });

  it("preserves account A's tokens after adding account B", async () => {
    const supabase = createFakeSupabase(sessionA);
    await snapshotCurrentSession(supabase);
    await addAccount(supabase, sessionB);

    const saved = readAccounts();
    expect(saved).toHaveLength(2);
    const a = saved.find((s) => s.email === "a@example.com");
    const b = saved.find((s) => s.email === "b@example.com");
    expect(a?.refreshToken).toBe("refresh-A-1");
    expect(b?.refreshToken).toBe("refresh-B-1");
  });

  it("switches back to account A without re-login", async () => {
    const supabase = createFakeSupabase(sessionA);
    await snapshotCurrentSession(supabase);
    await addAccount(supabase, sessionB);

    // Currently logged in as B
    expect(supabase._internal.current?.user.email).toBe("b@example.com");

    const accountA = readAccounts().find((a) => a.email === "a@example.com")!;
    const result = await switchToAccount(supabase, accountA);

    expect(result.ok).toBe(true);
    expect(supabase._internal.current?.user.email).toBe("a@example.com");
    // B's tokens must still be stored after switching
    const stillStoredB = readAccounts().find((a) => a.email === "b@example.com");
    expect(stillStoredB?.refreshToken).toBe("refresh-B-1");
  });

  it("can ping-pong between A and B repeatedly without losing either session", async () => {
    const supabase = createFakeSupabase(sessionA);
    await snapshotCurrentSession(supabase);
    await addAccount(supabase, sessionB);

    for (let i = 0; i < 4; i++) {
      const targetEmail = i % 2 === 0 ? "a@example.com" : "b@example.com";
      const target = readAccounts().find((a) => a.email === targetEmail)!;
      const r = await switchToAccount(supabase, target);
      expect(r.ok).toBe(true);
      expect(supabase._internal.current?.user.email).toBe(targetEmail);
      // Both accounts must remain stored with valid tokens
      const all = readAccounts();
      expect(all).toHaveLength(2);
      for (const acc of all) {
        expect(acc.refreshToken).toBeTruthy();
        expect(acc.accessToken).toBeTruthy();
      }
    }
  });

  it("falls back to needs-login when stored refresh token is revoked", async () => {
    const supabase = createFakeSupabase(sessionA);
    await snapshotCurrentSession(supabase);
    await addAccount(supabase, sessionB);

    // Server invalidates A's refresh token (e.g. password change)
    supabase._internal.invalidate("refresh-A-1");

    const accountA = readAccounts().find((a) => a.email === "a@example.com")!;
    const result = await switchToAccount(supabase, accountA);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("expired");
  });

  it("legacy entries without tokens are flagged as needs-login", async () => {
    const supabase = createFakeSupabase(sessionA);
    persistAccounts([
      { email: "legacy@example.com", lastLogin: new Date().toISOString() },
    ]);
    const legacy = readAccounts()[0];
    const result = await switchToAccount(supabase, legacy);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("needs-login");
  });
});
