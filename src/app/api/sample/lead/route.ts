import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/auth/api-guard";

/**
 * POST /api/sample/lead  { email?, phone?, attemptId? }
 * Captures a contact at the sample-unlock step (the highest-intent moment).
 * Writes via the service role into sample_leads (RLS on, no client access).
 * Best-effort: never blocks the unlock flow.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    email?: string;
    phone?: string;
    attemptId?: string;
  };
  const email = (body.email || "").trim().slice(0, 200) || null;
  const phone = (body.phone || "").trim().slice(0, 40) || null;
  if (!email && !phone) {
    return NextResponse.json({ ok: false, error: "email or phone required" }, { status: 400 });
  }
  // Light validation only; storage is the point, not perfection.
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ ok: false, error: "invalid email" }, { status: 400 });
  }
  try {
    const db = serviceClient();
    await db.from("sample_leads").insert({
      email,
      phone,
      attempt_id: body.attemptId || null,
      source: "sample_unlock",
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true }); // never block the funnel on a write error
  }
}
