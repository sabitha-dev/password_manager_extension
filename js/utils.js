// Shared helpers (imported by the background service worker).

/** "https://www.Example.com/login" | "example.com" -> "example.com" */
export function normalizeHost(value) {
  if (!value || typeof value !== "string") return "";
  const raw = value.trim();
  if (!raw) return "";
  try {
    const url = new URL(raw.includes("://") ? raw : `https://${raw}`);
    return url.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

/**
 * True when a saved site and the page being visited belong to the same site:
 * identical hosts, or one is a sub-domain of the other.
 *
 * This replaces `savedUrl.includes(hostname)`, which also matched look-alike
 * hosts (e.g. a saved "bank.com" entry matched the page "ank.com") and could
 * hand a saved password to the wrong site.
 */
export function hostMatches(savedSiteUrl, pageHost) {
  const saved = normalizeHost(savedSiteUrl);
  const page = normalizeHost(pageHost);
  if (!saved || !page) return false;
  return (
    saved === page ||
    page.endsWith(`.${saved}`) ||
    saved.endsWith(`.${page}`)
  );
}

export function sameUsername(a, b) {
  return (a || "").trim().toLowerCase() === (b || "").trim().toLowerCase();
}
