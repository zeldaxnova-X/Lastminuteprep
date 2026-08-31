import { NextRequest, NextResponse } from "next/server";
import { loadOwnedAttempt } from "@/lib/auth/api-guard";
import { getViewer } from "@/lib/auth/plan";
import { buildAndStoreReport } from "@/lib/exam/build-report";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { discountForGap, makeCouponCode, COUPON_TTL_HOURS } from "@/lib/payments/coupons";

/**
 * POST /api/offer/score-gap  { attemptId }
 *
 * Mint (or return) a single score-gap coupon for the signed-in user, sized by
 * the gap MarksenseAI found on their free mock. The gap is computed SERVER-SIDE
 * from the owned attempt (never trusted from the client). Anonymous sample
 * viewers get nothing here; the coupon is created once they have an account and
 * this route is called with their (now-claimed) attempt.
 */
export async function POST(req: NextRequest) {
  const { attemptId } = (await req.json().catch(() => ({}))) as { attemptId?: string };
  if (!attemptId) return NextResponse.json({ offer: null });

  const viewer = await getViewer();
  if (!viewer.authenticated || !viewer.userId) {
    return NextResponse.json({ offer: null, reason: "auth_required" });
  }
  // Already-paid accounts don't need a first-cycle discount.
  if (viewer.plan !== "free") return NextResponse.json({ offer: null, reason: "already_paid" });

  const access = await loadOwnedAttempt(attemptId);
  if (!access.ok) return NextResponse.json({ offer: null, reason: "not_owner" });

  const built = await buildAndStoreReport(access.db, attemptId);
  if (!built.ok || !built.analysis) return NextResponse.json({ offer: null, reason: "no_report" });

  const gap = Math.max(0, Math.round(built.analysis.optimal.gain));
  const pct = discountForGap(gap);
  const service = createServerSupabaseClient();
  const nowIso = new Date().toISOString();

  // A live coupon is stable: return it rather than re-minting on every view.
  const { data: active } = await service
    .from("coupons")
    .select("code, discount_pct, gap_marks, expires_at")
    .eq("user_id", viewer.userId)
    .eq("source", "score_gap")
    .is("used_at", null)
    .gt("expires_at", nowIso)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (active) {
    return NextResponse.json({
      offer: {
        discount_pct: active.discount_pct,
        gap: Number(active.gap_marks ?? gap),
        expires_at: active.expires_at,
        code: active.code,
      },
    });
  }

  // Clear any stale unused coupons and mint a fresh one.
  await service
    .from("coupons")
    .delete()
    .eq("user_id", viewer.userId)
    .eq("source", "score_gap")
    .is("used_at", null);

  const expires_at = new Date(Date.now() + COUPON_TTL_HOURS * 3600 * 1000).toISOString();
  const code = makeCouponCode();
  const { error } = await service.from("coupons").insert({
    user_id: viewer.userId,
    code,
    discount_pct: pct,
    gap_marks: gap,
    source: "score_gap",
    expires_at,
  });
  if (error) {
    console.error("Coupon mint failed:", error.message);
    return NextResponse.json({ offer: null, reason: "insert_failed" });
  }
  return NextResponse.json({ offer: { discount_pct: pct, gap, expires_at, code } });
}
