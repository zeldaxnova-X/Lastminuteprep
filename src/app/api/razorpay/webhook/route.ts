import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { razorpay, isPaidPlan } from "@/lib/payments/razorpay";

/**
 * POST /api/razorpay/webhook, the ONLY place a real payment grants a plan.
 *
 * Verifies X-Razorpay-Signature = HMAC-SHA256(rawBody, RAZORPAY_WEBHOOK_SECRET)
 *, the WEBHOOK signing secret, distinct from the API key_secret. A bad/absent
 * signature → 400 with no side effect. On a verified payment.captured/order.paid
 * event it reads the ORDER notes ({userId, plan, scope}, set server-side at
 * order creation), records the payment in the ledger (idempotency + audit), and
 * grants the account-wide plan via the service role.
 *
 * Idempotent: razorpay_payments.razorpay_payment_id is unique and an
 * already-"granted" payment is a no-op, so Razorpay's retries / duplicate events
 * never double-apply. Independent of the client, so a closed tab never loses the
 * entitlement.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    console.error("RAZORPAY_WEBHOOK_SECRET is not configured.");
    return NextResponse.json({ error: "Webhook not configured." }, { status: 500 });
  }

  // Signature must be computed over the RAW body, before any JSON parsing.
  const raw = await req.text();
  const provided = Buffer.from(req.headers.get("x-razorpay-signature") ?? "", "utf8");
  const expected = Buffer.from(
    crypto.createHmac("sha256", secret).update(raw).digest("hex"),
    "utf8"
  );
  if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  let event: {
    event?: string;
    id?: string;
    payload?: {
      payment?: { entity?: Record<string, unknown> };
      order?: { entity?: { notes?: Record<string, string> } };
    };
  };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Malformed payload." }, { status: 400 });
  }

  // Only these events grant entitlement; ack everything else so Razorpay stops.
  if (event.event !== "payment.captured" && event.event !== "order.paid") {
    return NextResponse.json({ received: true, ignored: event.event ?? null });
  }

  const payment = event.payload?.payment?.entity ?? {};
  const paymentId = payment.id as string | undefined;
  const orderId = payment.order_id as string | undefined;
  if (!paymentId || !orderId) {
    return NextResponse.json({ error: "Missing payment/order id." }, { status: 400 });
  }

  const admin = createServerSupabaseClient();

  // Idempotency: if this payment was already granted, no-op.
  const { data: existing } = await admin
    .from("razorpay_payments")
    .select("status")
    .eq("razorpay_payment_id", paymentId)
    .maybeSingle();
  if (existing?.status === "granted") {
    return NextResponse.json({ received: true, idempotent: true });
  }

  // Resolve WHO/WHAT to grant from the order notes (server-set; never client).
  // Prefer notes carried on the order entity; else fetch the order via the API.
  let notes: Record<string, string> = event.payload?.order?.entity?.notes ?? {};
  if (!notes.plan || !notes.userId) {
    try {
      const order = await razorpay().orders.fetch(orderId);
      notes = (order.notes ?? {}) as Record<string, string>;
    } catch (err) {
      console.error("Razorpay order fetch failed in webhook:", err);
      return NextResponse.json({ error: "Could not confirm the order." }, { status: 502 });
    }
  }
  const plan = notes.plan;
  const userId = notes.userId;
  const scope = notes.scope ?? null;
  const resolvable = isPaidPlan(plan) && !!userId;

  // Record the payment (audit + idempotency), regardless of resolvability.
  await admin.from("razorpay_payments").upsert(
    {
      razorpay_payment_id: paymentId,
      razorpay_order_id: orderId,
      user_id: userId ?? null,
      plan: plan ?? null,
      scope,
      amount: (payment.amount as number) ?? null,
      currency: (payment.currency as string) ?? null,
      status: resolvable ? "processing" : "unresolved",
      event_id: event.id ?? req.headers.get("x-razorpay-event-id") ?? null,
      raw: event,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "razorpay_payment_id" }
  );

  if (!resolvable) {
    return NextResponse.json({ received: true, granted: false, reason: "unresolved order notes" });
  }

  // Grant the account-wide plan (service role, plan changes never trust client).
  // TODO(per-exam): when multi-exam launches, write entitlements[scope] = plan
  //   here instead of the top-level `plan` column. `scope` is already recorded.
  const { error: grantErr } = await admin.from("profiles").update({ plan }).eq("id", userId);
  if (grantErr) {
    console.error("Plan grant failed in webhook:", grantErr);
    await admin
      .from("razorpay_payments")
      .update({ status: "grant_failed", updated_at: new Date().toISOString() })
      .eq("razorpay_payment_id", paymentId);
    // 500 → Razorpay retries; the retry re-attempts the grant (status != granted).
    return NextResponse.json({ error: "Grant failed." }, { status: 500 });
  }

  await admin
    .from("razorpay_payments")
    .update({ status: "granted", updated_at: new Date().toISOString() })
    .eq("razorpay_payment_id", paymentId);

  return NextResponse.json({ received: true, granted: true, plan });
}
