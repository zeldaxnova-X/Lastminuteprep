/**
 * Sanitise a `next` redirect target: only same-origin absolute PATHS are
 * allowed (must start with a single "/"). Anything else, external URLs,
 * protocol-relative "//evil.com", missing, collapses to a safe default.
 */
export function safeNext(next: string | null | undefined, fallback = "/dashboard"): string {
  if (!next) return fallback;
  if (!next.startsWith("/") || next.startsWith("//")) return fallback;
  return next;
}
