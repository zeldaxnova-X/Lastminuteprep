/**
 * Client-side funnel event helper. Fire-and-forget POST to /api/events, which
 * stamps anon/auth + user id server-side. Never throws, never blocks the UI.
 */
export function trackEvent(
  event:
    | "signup_started"
    | "signup_completed"
    | "upgrade_cta_viewed"
    | "upgrade_started"
    | "report_teaser_viewed",
  props?: Record<string, unknown>
): void {
  try {
    void fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, props: props ?? {} }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* no-op */
  }
}
