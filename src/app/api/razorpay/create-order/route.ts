import { NextRequest, NextResponse } from "next/server";
import { getSessionContext, json401 } from "@/lib/auth/api-guard";
import { razorpay, CURRENCY, EXAM_SCOPE } from "@/lib/payments/razorpay";
import { applyDiscount } from "@/lib/payments/coupons";
import { allAccessAmountPaise, allAccessAccessDays, isLaunchOffer, ALL_ACCESS_DESCRIPTION } from "@/lib/payments/pricing";

/**
 * POST /api/razorpay/create-order
 *
 * There is a single paid product — the All-Access pass (unlocks every exam +
 * MarksenseAI). Any legacy `plan`/`billing` in the body is ignored: the amount
 * and the granted plan are decided ENTIRELY server-side (the client never sends
 * an amount). The pass grants the `mentor` plan (highest entitlement); during
 * launch a ₹49 one-time pass runs through the launch end date, after which it is
 * a ₹99 monthly window (see pricing.ts, all by date). The buyer's id + granted
 * plan + days are stamped into the order `notes` so the webhook grants exactly
 * what was paid for, to exactly who paid, no client trust.
 */
export async function POST(req: NextRequest) {
  // Identity is server-derived from the request cookies, the SAME helper the
  // CBT routes use (getSessionContext -> cookie-aware @supabase/ssr client).
  const { user, supabase } = await getSessionContext();
  if (!user) return json401();
  const userId = user.id;

  // Pre-purchase policy consent (E2), stamped into the order notes so the
  // accepted policy version + timestamp are provable later.
  const body = (await req.json().catch(() => ({}))) as {
    consent?: { policyVersion?: string; consentAt?: string };
  };
  const policyVersion = (body.consent?.policyVersion || "").slice(0, 16) || null;
  const consentAt = (body.consent?.consentAt || "").slice(0, 40) || null;

  // Single product: the All-Access pass. `plan` is always granted as `mentor`
  // (unlocks everything). During launch a ₹49 one-time pass runs THROUGH the
  // launch end date (days computed to land on 31 Oct 2026); after launch it is a
  // ₹99 30-day monthly window. `billing` records which for the ledger.
  const grantedPlan = "mentor";
  const billing = isLaunchOffer() ? "launch_pass" : "monthly";
  const days = allAccessAccessDays();
  const listAmount = allAccessAmountPaise(); // ₹49 during launch, ₹99 after (by date)
  if (listAmount < 100) {
    // Guard against a misconfigured price (Razorpay minimum is 100 paise).
    return NextResponse.json({ error: "Configured amount is below the minimum." }, { status: 500 });
  }

  // Apply the user's active score-gap coupon, if any. RLS lets the owner read
  // only their own coupons; the amount is still decided entirely server-side.
  let amount = listAmount;
  let couponCode: string | null = null;
  let discountPct = 0;
  const { data: coupon } = await supabase
    .from("coupons")
    .select("code, discount_pct")
    .eq("source", "score_gap")
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (coupon) {
    discountPct = coupon.discount_pct;
    couponCode = coupon.code;
    amount = applyDiscount(listAmount, discountPct);
  }

  try {
    const order = await razorpay().orders.create({
      amount,
      currency: CURRENCY,
      receipt: `rcpt_${userId.slice(0, 8)}_${Date.now()}`,
      // scope makes the payment per-exam-ready; the webhook reads these notes as
      // the source of truth for who/what to grant (never the client). `days` is
      // the access window this purchase grants (one-time-with-expiry billing).
      // `coupon` (when present) is marked used by the webhook after the grant.
      notes: {
        userId,
        plan: grantedPlan,
        billing,
        days: String(days),
        scope: EXAM_SCOPE,
        description: ALL_ACCESS_DESCRIPTION,
        ...(policyVersion ? { policyVersion } : {}),
        ...(consentAt ? { consentAt } : {}),
        ...(couponCode ? { coupon: couponCode } : {}),
      },
    });

    return NextResponse.json({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      // Public key id only, safe for the browser to open the modal.
      key_id: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err: unknown) {
    // Razorpay rejecting our API credentials is an UPSTREAM/config failure, not
    // a user-auth problem, return 502 (never 401) so it can't be mistaken for a
    // session issue. Almost always a mismatched RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET
    // pair or a test/live mode mismatch in the deployment env.
    const statusCode = (err as { statusCode?: number })?.statusCode;
    if (statusCode === 401) {
      console.error(
        "Razorpay rejected the API credentials (401). Check RAZORPAY_KEY_ID and " +
          "RAZORPAY_KEY_SECRET are a matching pair from the SAME mode (test/live) in this env."
      );
      return NextResponse.json(
        { error: "Payment gateway configuration error. Please try again later or contact support." },
        { status: 502 }
      );
    }
    console.error("Razorpay create-order error:", err);
    return NextResponse.json({ error: "Could not create payment order." }, { status: 500 });
  }
}
