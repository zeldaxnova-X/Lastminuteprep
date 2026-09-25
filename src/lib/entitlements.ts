/**
 * Report entitlement — the single server-side authority for WHO may see the full
 * report of an attempt. Used by every route that could leak gated content
 * (/report, /result, /[attemptId]) so the gate can't be bypassed by hitting a
 * different endpoint. The full payload is simply never assembled for a caller
 * who isn't entitled — nothing gated is sent and hidden client-side.
 *
 * Full report is unlocked when the caller is the AUTHENTICATED OWNER of the
 * attempt AND one of:
 *   • their plan is All-Access (pro/mentor rank ≥ pro), or
 *   • they bought the ₹9 single-attempt unlock (report_unlocks row).
 * Anonymous callers and signed-in-free callers without an unlock get headline
 * only (net/section/accuracy/counts).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { serviceClient } from "@/lib/auth/api-guard";
import { canSeeReport, getViewer, type Plan, type Viewer } from "@/lib/auth/plan";

export interface ReportAccess {
  /** Full report (review + analysis + narrative) is permitted for this caller. */
  full: boolean;
  /** The caller is the authenticated owner of the attempt. */
  isOwner: boolean;
  /** Why full is false, for teaser telemetry: null when full. */
  reason: null | "anonymous" | "not_owner" | "locked";
  viewer: Viewer;
}

export interface ReportDecision {
  full: boolean;
  isOwner: boolean;
  reason: null | "anonymous" | "not_owner" | "locked";
}

/**
 * PURE gate decision (no IO) so it can be unit-tested and reasoned about in one
 * place. Full report requires the authenticated OWNER, plus either an All-Access
 * plan or the ₹9 per-attempt unlock. Everyone else gets headline only.
 */
export function decideReportAccess(input: {
  authenticated: boolean;
  viewerId: string | null;
  plan: Plan;
  attemptUserId: string | null;
  unlocked: boolean;
}): ReportDecision {
  if (!input.authenticated || !input.viewerId) {
    return { full: false, isOwner: false, reason: "anonymous" };
  }
  if (input.attemptUserId !== input.viewerId) {
    return { full: false, isOwner: false, reason: "not_owner" };
  }
  if (canSeeReport(input.plan) || input.unlocked) {
    return { full: true, isOwner: true, reason: null };
  }
  return { full: false, isOwner: true, reason: "locked" };
}

/** True if this user has paid the ₹9 unlock for this attempt. Service-role read
 *  (report_unlocks has no client RLS policy). */
export async function hasReportUnlock(attemptId: string, userId: string): Promise<boolean> {
  const svc = serviceClient();
  const { data } = await svc
    .from("report_unlocks")
    .select("attempt_id")
    .eq("attempt_id", attemptId)
    .eq("user_id", userId)
    .maybeSingle();
  return !!data;
}

/**
 * Resolve report access for the current viewer against an attempt row.
 * `attemptUserId` is the owner id on the attempt (null for an anonymous attempt).
 */
export async function resolveReportAccess(
  attemptId: string,
  attemptUserId: string | null
): Promise<ReportAccess> {
  const viewer = await getViewer();

  // Only pay for the unlock lookup when it can matter (authenticated owner on a
  // non-All-Access plan).
  const isOwner = !!viewer.userId && attemptUserId === viewer.userId;
  const unlocked =
    isOwner && !canSeeReport(viewer.plan) ? await hasReportUnlock(attemptId, viewer.userId!) : false;

  const decision = decideReportAccess({
    authenticated: viewer.authenticated,
    viewerId: viewer.userId,
    plan: viewer.plan,
    attemptUserId,
    unlocked,
  });
  return { ...decision, viewer };
}

/** Convenience for routes that already hold a user-scoped db but must read the
 *  service-only unlock ledger. Kept here so callers import one module. */
export type { SupabaseClient };
