// Runtime detection for the admin subdomain.
// Admin panel is served on admin.stengg.it.com; the main site (stengg.it.com,
// preview URLs, lovable.app) hides /admin/* and redirects there.

export const ADMIN_HOST = "admin.stengg.it.com";

export function isAdminHost(): boolean {
  if (typeof window === "undefined") return false;
  return window.location.hostname === ADMIN_HOST;
}

export function adminHostUrl(pathname = "/admin"): string {
  return `https://${ADMIN_HOST}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
}

// True when the host is a "public" host that should hide the admin area.
// Preview / lovable.app hosts still expose /admin for development convenience.
export function isPublicProdHost(): boolean {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  return h === "stengg.it.com" || h === "www.stengg.it.com";
}
