import { supabase } from "@/integrations/supabase/client";

/**
 * Helpers to work with the private `uploads` bucket via signed URLs.
 *
 * The bucket is private (RLS-locked). Authenticated users and verified guests
 * can generate signed URLs at read time. For long-lived public-facing assets
 * (banners, news, products, deposit QR), we mint a very long signed URL at
 * upload time and persist it in the DB so anonymous visitors can still view
 * them — signed URLs bypass RLS, so the JWT alone authorises access.
 */

/** 1 hour — short-lived signed URLs for chat attachments. */
export const CHAT_ATTACHMENT_TTL = 60 * 60;
/** 10 years — long-lived signed URLs for marketing assets persisted in DB. */
export const PUBLIC_ASSET_TTL = 60 * 60 * 24 * 365 * 10;

/**
 * Extract the path inside the `uploads` bucket from either a stored path or a
 * legacy public/signed URL. Returns null when the input is an external URL
 * (e.g. https://example.com/img.jpg) that does not live in our storage.
 */
export function extractUploadsPath(pathOrUrl: string | null | undefined): string | null {
  if (!pathOrUrl) return null;
  const trimmed = pathOrUrl.trim();
  if (!trimmed) return null;

  // Already a bare storage path.
  if (!/^https?:\/\//i.test(trimmed)) return trimmed.replace(/^\/+/, "");

  // Public URL: .../storage/v1/object/public/uploads/<path>
  // Signed URL: .../storage/v1/object/sign/uploads/<path>?token=...
  const m = trimmed.match(/\/storage\/v1\/object\/(?:public|sign|authenticated)\/uploads\/([^?#]+)/);
  if (m) {
    try {
      return decodeURIComponent(m[1]);
    } catch {
      return m[1];
    }
  }
  return null; // External URL — not in our bucket.
}

/**
 * Convert a stored value (path or legacy URL) to a fresh signed URL.
 * Returns the original value when:
 *  - input is empty
 *  - input is an external URL not under our uploads bucket
 *  - signing fails (e.g. RLS denies)
 */
export async function signUploadsUrl(
  pathOrUrl: string | null | undefined,
  expiresInSeconds = CHAT_ATTACHMENT_TTL
): Promise<string> {
  if (!pathOrUrl) return "";
  const path = extractUploadsPath(pathOrUrl);
  if (!path) return pathOrUrl; // external URL — pass through

  try {
    const { data, error } = await supabase.storage
      .from("uploads")
      .createSignedUrl(path, expiresInSeconds);
    if (error || !data?.signedUrl) {
      console.warn("[signUploadsUrl] failed", { path, error });
      return pathOrUrl;
    }
    return data.signedUrl;
  } catch (e) {
    console.warn("[signUploadsUrl] exception", { path, e });
    return pathOrUrl;
  }
}

/**
 * Upload to the `uploads` bucket and return a long-lived signed URL suitable
 * for storage in the DB and direct rendering on public pages.
 */
export async function uploadPublicAsset(
  filePath: string,
  file: File,
  options?: { upsert?: boolean; contentType?: string }
): Promise<string> {
  const { error: uploadError } = await supabase.storage
    .from("uploads")
    .upload(filePath, file, {
      upsert: options?.upsert ?? false,
      contentType: options?.contentType,
    });
  if (uploadError) throw uploadError;

  const { data, error } = await supabase.storage
    .from("uploads")
    .createSignedUrl(filePath, PUBLIC_ASSET_TTL);
  if (error || !data?.signedUrl) {
    throw error ?? new Error("Failed to create signed URL");
  }
  return data.signedUrl;
}