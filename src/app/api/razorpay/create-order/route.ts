import { NextRequest, NextResponse } from "next/server";
import { getSessionContext, json401 } from "@/lib/auth/api-guard";
import { razorpay, PLAN_PRICING, CURRENCY, EXAM_SCOPE, isPaidPlan } from "@/lib/payments/razorpay";

/**
 * POST /api/razorpay/create-order  { plan: "pro" | "mentor" }
 *
 * Creates a Razorpay order for the signed-in user. The amount is chosen
 * server-side from the plan (the client never sends an amount). The buyer's id
 * and target plan are stamped into the order `notes` so verify-payment can grant
 * exactly what was paid for, to exactly who paid, no client trust.
 */
export async function POST(req: NextRequest) {
  // Identity is server-derived from the request cookies, the SAME helper the
  // CBT routes use (getSessionContext -> cookie-aware @supabase/ssr client).
  const { user } = await getSessionContext();
  if (!user) return json401();
  const userId = user.id;

  const body = (await req.json().catch(() => ({}))) as { plan?: string };
  if (!isPaidPlan(body.plan)) {
    return NextResponse.json(
      { error: "Invalid plan. Expected 'pro' or 'mentor'." },
      { status: 400 }
    );
  }

  const { amount } = PLAN_PRICING[body.plan];
  if (amount < 100) {
    // Guard against a misconfigured price table (Razorpay minimum is 100 paise).
    return NextResponse.json({ error: "Configured amount is below the minimum." }, { status: 500 });
  }

  try {
    const order = await razorpay().orders.create({
      amount,
      currency: CURRENCY,
      receipt: `rcpt_${userId.slice(0, 8)}_${Date.now()}`,
      // scope makes the payment per-exam-ready; the webhook reads these notes as
      // the source of truth for who/what to grant (never the client).
      notes: { userId, plan: body.plan, scope: EXAM_SCOPE },
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
