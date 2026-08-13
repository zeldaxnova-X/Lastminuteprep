import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getViewer } from "@/lib/auth/plan";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { razorpay, isPaidPlan } from "@/lib/payments/razorpay";

/**
 * POST /api/razorpay/verify-payment
 *   { razorpay_order_id, razorpay_payment_id, razorpay_signature }
 *
 * Verifies the Razorpay signature (HMAC-SHA256 of "order_id|payment_id" with the
 * KEY_SECRET). Only on a match do we grant the plan — and we grant the plan the
 * ORDER was created for (read back from the order's server-set notes), to the
 * user the order belongs to. The client cannot upgrade a different plan, a
 * different user, or itself without a genuine matching signature.
 */
export async function POST(req: NextRequest) {
  const viewer = await getViewer();
  if (!viewer.authenticated || !viewer.userId) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

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

  // Signature is valid. Resolve WHAT was purchased from the order's server-set
  // notes (never from the client), and confirm the order belongs to this user.
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
  if (notesUserId !== viewer.userId) {
    // The paying account must match the account being upgraded.
    return NextResponse.json({ error: "This order belongs to a different account." }, { status: 403 });
  }

  // Grant the plan server-side (service role — plan changes never trust the client).
  const admin = createServerSupabaseClient();
  const { error } = await admin.from("profiles").update({ plan }).eq("id", viewer.userId);
  if (error) {
    console.error("Plan grant failed after verified payment:", error);
    return NextResponse.json({ error: "Payment verified but plan update failed." }, { status: 500 });
  }

  return NextResponse.json({ success: true, plan });
}
