// Periodic cleanup for the private `uploads` bucket.
//
// Scans every object under `uploads/` and deletes files that are:
//   1) older than `older_than_days` (default 7), AND
//   2) not referenced by any DB column that stores an uploads path/URL.
//
// Since we disabled UPDATE policies on storage.objects (files are write-once),
// replacing an image creates a new file and leaves the old one behind. This
// job reclaims that space.
//
// Trigger: pg_cron (weekly) or manual invoke by an admin.
//   - Cron: hits with header `x-cron-secret: <CRON_SECRET>`
//   - Manual: authenticated admin bearer token
//
// Body (all optional): { older_than_days?: number, dry_run?: boolean, limit?: number }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";

const BUCKET = "uploads";

/** Extract the storage path from either a bare path or a public/signed URL. */
function extractPath(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) return s.replace(/^\/+/, "");
  const m = s.match(
    /\/storage\/v1\/object\/(?:public|sign|authenticated)\/uploads\/([^?#]+)/,
  );
  if (!m) return null;
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return m[1];
  }
}

function collectStringsFromJson(node: unknown, out: string[]) {
  if (!node) return;
  if (typeof node === "string") {
    out.push(node);
    return;
  }
  if (Array.isArray(node)) {
    for (const n of node) collectStringsFromJson(n, out);
    return;
  }
  if (typeof node === "object") {
    for (const v of Object.values(node as Record<string, unknown>)) {
      collectStringsFromJson(v, out);
    }
  }
}

async function authorize(req: Request): Promise<
  { ok: true } | { ok: false; status: number; error: string }
> {
  const cronHeader = req.headers.get("x-cron-secret");
  if (CRON_SECRET && cronHeader && cronHeader === CRON_SECRET) return { ok: true };

  const auth = req.headers.get("authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!token) return { ok: false, status: 401, error: "Missing authorization" };

  // Cron/internal callers use the service-role JWT directly.
  if (token === SERVICE_ROLE) return { ok: true };

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData?.user) {
    return { ok: false, status: 401, error: "Invalid token" };
  }
  const { data: roleData } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userData.user.id)
    .eq("role", "admin")
    .maybeSingle();
  if (!roleData) return { ok: false, status: 403, error: "Admin only" };
  return { ok: true };
}

async function loadReferencedPaths(
  admin: ReturnType<typeof createClient>,
): Promise<Set<string>> {
  const refs = new Set<string>();
  const add = (v: unknown) => {
    const p = extractPath(v);
    if (p) refs.add(p);
  };

  // Simple text columns.
  const queries: Array<[string, string[]]> = [
    ["profiles", ["avatar_url"]],
    ["products", ["image_url"]],
    ["news", ["image_url"]],
    ["hero_banners", ["image_url"]],
    ["charity_programs", ["image_url"]],
    ["savings_packages", ["image_url"]],
    ["identity_verifications", ["front_image_url", "back_image_url"]],
    ["live_chat_messages", ["attachment_url"]],
  ];

  for (const [table, cols] of queries) {
    const { data, error } = await admin
      .from(table)
      .select(cols.join(","));
    if (error) {
      console.warn(`[cleanup] read ${table} failed:`, error.message);
      continue;
    }
    for (const row of data ?? []) {
      for (const c of cols) add((row as Record<string, unknown>)[c]);
    }
  }

  // deposit_settings.config is JSONB — QR image lives inside it.
  const { data: ds } = await admin.from("deposit_settings").select("config");
  for (const row of ds ?? []) {
    const strings: string[] = [];
    collectStringsFromJson((row as { config: unknown }).config, strings);
    for (const s of strings) add(s);
  }

  return refs;
}

async function listAllObjects(
  admin: ReturnType<typeof createClient>,
  prefix = "",
  maxItems = 50000,
): Promise<Array<{ path: string; created_at: string | null }>> {
  const results: Array<{ path: string; created_at: string | null }> = [];
  const stack: string[] = [prefix];
  const PAGE = 1000;

  while (stack.length && results.length < maxItems) {
    const dir = stack.pop()!;
    let offset = 0;
    while (true) {
      const { data, error } = await admin.storage
        .from(BUCKET)
        .list(dir, { limit: PAGE, offset, sortBy: { column: "name", order: "asc" } });
      if (error) {
        console.warn(`[cleanup] list "${dir}" failed:`, error.message);
        break;
      }
      if (!data || data.length === 0) break;
      for (const entry of data) {
        // Folders have id === null.
        const full = dir ? `${dir}/${entry.name}` : entry.name;
        if (entry.id === null) {
          stack.push(full);
        } else {
          results.push({
            path: full,
            created_at: entry.created_at ?? null,
          });
          if (results.length >= maxItems) break;
        }
      }
      if (data.length < PAGE) break;
      offset += PAGE;
    }
  }
  return results;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const authz = await authorize(req);
  if (!authz.ok) {
    return new Response(JSON.stringify({ error: authz.error }), {
      status: authz.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: { older_than_days?: number; dry_run?: boolean; limit?: number } = {};
  try {
    body = await req.json();
  } catch {
    // no body → defaults
  }
  const olderThanDays = Math.max(0, Number(body.older_than_days ?? 7));
  const dryRun = Boolean(body.dry_run);
  const maxDeletes = Math.max(1, Math.min(Number(body.limit ?? 5000), 20000));

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const cutoff = Date.now() - olderThanDays * 86_400_000;

  const [refs, all] = await Promise.all([
    loadReferencedPaths(admin),
    listAllObjects(admin),
  ]);

  const orphans: string[] = [];
  let skippedYoung = 0;
  let skippedReferenced = 0;

  for (const obj of all) {
    if (refs.has(obj.path)) {
      skippedReferenced++;
      continue;
    }
    const created = obj.created_at ? Date.parse(obj.created_at) : NaN;
    if (!Number.isFinite(created) || created > cutoff) {
      skippedYoung++;
      continue;
    }
    orphans.push(obj.path);
    if (orphans.length >= maxDeletes) break;
  }

  let deleted = 0;
  const errors: string[] = [];
  if (!dryRun && orphans.length) {
    // Storage remove accepts up to ~1000 keys per call.
    const CHUNK = 500;
    for (let i = 0; i < orphans.length; i += CHUNK) {
      const slice = orphans.slice(i, i + CHUNK);
      const { data, error } = await admin.storage.from(BUCKET).remove(slice);
      if (error) {
        errors.push(error.message);
      } else {
        deleted += data?.length ?? slice.length;
      }
    }
  }

  const summary = {
    ok: true,
    dry_run: dryRun,
    older_than_days: olderThanDays,
    scanned: all.length,
    referenced_paths: refs.size,
    skipped_referenced: skippedReferenced,
    skipped_too_young: skippedYoung,
    orphans_found: orphans.length,
    deleted: dryRun ? 0 : deleted,
    errors,
    sample_orphans: orphans.slice(0, 20),
  };

  // Best-effort audit trail.
  try {
    await admin.from("audit_logs").insert({
      user_id: null,
      action: "cleanup_orphan_uploads",
      entity_type: "storage",
      entity_id: null,
      details: summary,
    });
  } catch (_) {
    // ignore
  }

  return new Response(JSON.stringify(summary), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: 200,
  });
});