import { NextRequest, NextResponse } from "next/server";
import { getViewer } from "@/lib/auth/plan";
import { razorpay, PLAN_PRICING, CURRENCY, EXAM_SCOPE, isPaidPlan } from "@/lib/payments/razorpay";

/**
 * POST /api/razorpay/create-order  { plan: "pro" | "mentor" }
 *
 * Creates a Razorpay order for the signed-in user. The amount is chosen
 * server-side from the plan (the client never sends an amount). The buyer's id
 * and target plan are stamped into the order `notes` so verify-payment can grant
 * exactly what was paid for, to exactly who paid — no client trust.
 */
export async function POST(req: NextRequest) {
  // Identity is server-derived; a real purchase requires a signed-in account.
  const viewer = await getViewer();
  if (!viewer.authenticated || !viewer.userId) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

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
      receipt: `rcpt_${viewer.userId.slice(0, 8)}_${Date.now()}`,
      // scope makes the payment per-exam-ready; the webhook reads these notes as
      // the source of truth for who/what to grant (never the client).
      notes: { userId: viewer.userId, plan: body.plan, scope: EXAM_SCOPE },
    });

    return NextResponse.json({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      // Public key id only — safe for the browser to open the modal.
      key_id: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err: unknown) {
    // Razorpay surfaces auth problems as a 401 statusCode on the error.
    const statusCode = (err as { statusCode?: number })?.statusCode;
    if (statusCode === 401) {
      return NextResponse.json({ error: "Payment gateway authentication failed." }, { status: 401 });
    }
    console.error("Razorpay create-order error:", err);
    return NextResponse.json({ error: "Could not create payment order." }, { status: 500 });
  }
}
