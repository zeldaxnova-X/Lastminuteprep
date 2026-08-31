import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getSessionContext, json401 } from "@/lib/auth/api-guard";
import { razorpay, isPaidPlan } from "@/lib/payments/razorpay";

/**
 * POST /api/razorpay/verify-payment
 *   { razorpay_order_id, razorpay_payment_id, razorpay_signature }
 *
 * UX-ONLY. Verifies the checkout signature (HMAC-SHA256 of "order_id|payment_id"
 * with the KEY_SECRET) so the success screen can show a confident "payment
 * received, confirming your upgrade" state. It DELIBERATELY does NOT mutate the
 * plan, the plan is granted solely by the signature-verified webhook
 * (/api/razorpay/webhook), which is independent of the client (so closing the
 * tab never loses the entitlement, and a forged client callback can't upgrade).
 */
export async function POST(req: NextRequest) {
  // Same cookie-aware helper as the CBT routes (getSessionContext).
  const { user } = await getSessionContext();
  if (!user) return json401();

  const body = (await req.json().catch(() => ({}))) as {
    razorpay_order_id?: string;
    razorpay_payment_id?: string;
    razorpay_signature?: string;
  };
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return NextResponse.json(
      { error: "Missing required payment fields." },
      { status: 400 }
    );
  }

  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) {
    console.error("RAZORPAY_KEY_SECRET is not configured.");
    return NextResponse.json({ error: "Payment verification unavailable." }, { status: 500 });
  }

  // HMAC-SHA256(order_id + "|" + payment_id, KEY_SECRET).
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");

  const provided = Buffer.from(razorpay_signature, "utf8");
  const computed = Buffer.from(expected, "utf8");
  const signatureValid =
    provided.length === computed.length && crypto.timingSafeEqual(provided, computed);

  if (!signatureValid) {
    // Do NOT grant anything on a mismatch.
    return NextResponse.json({ error: "Payment signature verification failed." }, { status: 400 });
  }

  // Signature is valid. Read the order's server-set notes for a UX label only
  // (which plan is being confirmed) and confirm the order belongs to this user.
  // NO plan mutation happens here, that is the webhook's job.
  let plan: string | undefined;
  let notesUserId: string | undefined;
  try {
    const order = await razorpay().orders.fetch(razorpay_order_id);
    const notes = (order.notes ?? {}) as Record<string, string>;
    plan = notes.plan;
    notesUserId = notes.userId;
  } catch (err) {
    console.error("Razorpay order fetch failed during verify:", err);
    return NextResponse.json({ error: "Could not confirm the order." }, { status: 502 });
  }

  if (!isPaidPlan(plan)) {
    return NextResponse.json({ error: "Order has no valid plan." }, { status: 400 });
  }
  if (notesUserId !== user.id) {
    return NextResponse.json({ error: "This order belongs to a different account." }, { status: 403 });
  }

  // Signature good + order owned by caller. The webhook grants the plan; the
  // client should now poll for the plan to flip ("confirming your payment…").
  return NextResponse.json({ verified: true, plan, pending: true });
}
