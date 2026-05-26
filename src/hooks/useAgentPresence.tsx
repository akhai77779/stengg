import { useEffect, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AgentStatus = "online" | "away" | "offline";

interface AgentPresenceRow {
  user_id: string;
  status: AgentStatus;
  last_seen_at: string;
}

/**
 * Admin-side hook: writes/updates this admin's presence row.
 * - Sends heartbeat every 30s with status=online.
 * - When tab visibility changes to hidden, marks as away.
 * - On unmount / unload, marks offline.
 */
export function useAdminPresence(adminUserId: string | undefined) {
  const lastStatusRef = useRef<AgentStatus>("offline");

  const writeStatus = useCallback(
    async (status: AgentStatus) => {
      if (!adminUserId) return;
      lastStatusRef.current = status;
      await supabase
        .from("agent_presence")
        .upsert(
          {
            user_id: adminUserId,
            status,
            last_seen_at: new Date().toISOString(),
          },
          { onConflict: "user_id" },
        );
    },
    [adminUserId],
  );

  useEffect(() => {
    if (!adminUserId) return;

    // Mark online immediately
    writeStatus("online");

    // Heartbeat every 30s
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        writeStatus("online");
      }
    }, 30_000);

    const handleVisibility = () => {
      writeStatus(document.visibilityState === "visible" ? "online" : "away");
    };
    document.addEventListener("visibilitychange", handleVisibility);

    const handleUnload = () => {
      // navigator.sendBeacon would be ideal but supabase-js can't use it;
      // best-effort sync write via keepalive fetch through PostgREST.
      try {
        const url = `${(supabase as unknown as { supabaseUrl: string }).supabaseUrl}/rest/v1/agent_presence`;
        fetch(url, {
          method: "POST",
          keepalive: true,
          headers: {
            "Content-Type": "application/json",
            apikey: (supabase as unknown as { supabaseKey: string }).supabaseKey,
            Authorization: `Bearer ${(supabase as unknown as { supabaseKey: string }).supabaseKey}`,
            Prefer: "resolution=merge-duplicates",
          },
          body: JSON.stringify({
            user_id: adminUserId,
            status: "offline",
            last_seen_at: new Date().toISOString(),
          }),
        });
      } catch {
        /* noop */
      }
    };
    window.addEventListener("beforeunload", handleUnload);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("beforeunload", handleUnload);
      writeStatus("offline");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminUserId]);

  return { setStatus: writeStatus };
}

/**
 * Customer/guest-side hook: returns whether at least one admin is currently online
 * (last_seen within ~2 minutes). Polls every 30s.
 */
export function useOnlineAgentBadge() {
  const { data } = useQuery({
    queryKey: ["agent-presence-online-count"],
    queryFn: async () => {
      const cutoff = new Date(Date.now() - 2 * 60_000).toISOString();
      const { count, error } = await supabase
        .from("agent_presence")
        .select("user_id", { count: "exact", head: true })
        .eq("status", "online")
        .gt("last_seen_at", cutoff);
      if (error) {
        console.warn("[useOnlineAgentBadge]", error);
        return 0;
      }
      return count ?? 0;
    },
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  return { onlineCount: data ?? 0, isOnline: (data ?? 0) > 0 };
}

/** Admin-side: list of all presence rows for showing teammates' status. */
export function useAgentPresenceList() {
  return useQuery({
    queryKey: ["agent-presence-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agent_presence")
        .select("user_id, status, last_seen_at");
      if (error) throw error;
      return data as AgentPresenceRow[];
    },
    refetchInterval: 30_000,
  });
}