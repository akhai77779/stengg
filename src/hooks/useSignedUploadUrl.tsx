import { useEffect, useState } from "react";
import { signUploadsUrl, CHAT_ATTACHMENT_TTL } from "@/lib/storageUrls";

/**
 * Resolve a stored uploads path (or legacy URL) to a fresh signed URL.
 * Returns the empty string while loading so consumers can skip rendering
 * until the URL is ready.
 */
export function useSignedUploadUrl(
  pathOrUrl: string | null | undefined,
  expiresIn = CHAT_ATTACHMENT_TTL
): string {
  const [url, setUrl] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    if (!pathOrUrl) {
      setUrl("");
      return;
    }
    signUploadsUrl(pathOrUrl, expiresIn).then((u) => {
      if (!cancelled) setUrl(u);
    });
    return () => {
      cancelled = true;
    };
  }, [pathOrUrl, expiresIn]);

  return url;
}