import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getViewer } from "@/lib/auth/plan";

/**
 * POST /api/dev/simulate-upgrade  { tier: 'pro' | 'mentor' | 'free' }
 *
 * DEV ONLY. Lets you flip your own plan to test gated states without a real
 * payment. Hard-blocked in production. This is NOT the payment path — the real
 * upgrade will be a Razorpay webhook flipping `plan` server-side.
 *   // TODO: remove once Razorpay entitlement webhook lands.
 */
export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }

  const viewer = await getViewer();
  if (!viewer.authenticated || !viewer.userId) {
    return NextResponse.json({ error: "Sign in first" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as { tier?: string };
  const tier = body.tier === "mentor" ? "mentor" : body.tier === "free" ? "free" : "pro";

  // Service role (bypasses RLS) — plan changes are always server-only.
  const admin = createServerSupabaseClient();
  const { error } = await admin.from("profiles").update({ plan: tier }).eq("id", viewer.userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, plan: tier });
}
