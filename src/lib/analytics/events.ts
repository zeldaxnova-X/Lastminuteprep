/**
 * Minimal server-side funnel instrumentation. No third-party analytics is wired,
 * so events land in the `analytics_events` table (service-role only). Fire-and-
 * forget: a logging failure must NEVER break the request that emitted it.
 */
import { createServerSupabaseClient } from "@/lib/supabase-server";

export type FunnelEvent =
  | "mock_started"
  | "mock_completed"
  | "report_teaser_viewed"
  | "signup_started"
  | "signup_completed"
  | "report_unlocked"
  | "upgrade_cta_viewed"
  | "upgrade_started"
  | "upgrade_completed";

export interface EmitContext {
  /** Exam this event belongs to (e.g. "ssc-cgl"). */
  examCode?: string | null;
  /** True for a signed-out actor, false for an authenticated one. */
  anonymous: boolean;
  userId?: string | null;
  deviceToken?: string | null;
  /** Small, non-PII extra properties (attempt id, kind, amount, etc.). */
  props?: Record<string, unknown>;
}

/**
 * Record one funnel event. Best-effort: swallows all errors. Callers should not
 * await this on the hot path unless they specifically need ordering.
 */
export async function emitEvent(event: FunnelEvent, ctx: EmitContext): Promise<void> {
  try {
    const admin = createServerSupabaseClient();
    await admin.from("analytics_events").insert({
      event,
      exam_code: ctx.examCode ?? null,
      is_anonymous: ctx.anonymous,
      user_id: ctx.userId ?? null,
      device_token: ctx.deviceToken ?? null,
      props: ctx.props ?? {},
    });
  } catch {
    // Instrumentation is never allowed to affect the user-facing request.
  }
}
