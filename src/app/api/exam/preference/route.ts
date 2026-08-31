import { NextRequest, NextResponse } from "next/server";
import { getSessionContext, json401 } from "@/lib/auth/api-guard";
import { createServerSupabaseClient } from "@/lib/supabase-server";

/**
 * POST /api/exam/preference  { primary?: slug, notify?: slug[] }
 *
 * Records which exam the signed-in user is preparing for and adds any
 * not-yet-live picks to the per-exam waitlist (for launch messaging). Writes go
 * through the service role; the client only names known exam slugs.
 */
const KNOWN = new Set(["ssc-cgl", "ibps-clerk", "sbi-clerk", "jee-main", "neet-ug", "undecided"]);
const LIVE = new Set(["ssc-cgl"]);

export async function POST(req: NextRequest) {
  const { user } = await getSessionContext();
  if (!user) return json401();

  const body = (await req.json().catch(() => ({}))) as { primary?: string; notify?: string[] };
  const primary = typeof body.primary === "string" && KNOWN.has(body.primary) ? body.primary : null;
  const notify = Array.isArray(body.notify)
    ? body.notify.filter((s) => typeof s === "string" && KNOWN.has(s) && !LIVE.has(s) && s !== "undecided")
    : [];

  const service = createServerSupabaseClient();

  if (primary) {
    await service.from("profiles").update({ selected_exam: primary }).eq("id", user.id);
  }
  if (notify.length) {
    await service.from("exam_waitlist").upsert(
      notify.map((exam_slug) => ({ user_id: user.id, exam_slug })),
      { onConflict: "user_id,exam_slug", ignoreDuplicates: true }
    );
  }

  return NextResponse.json({ ok: true, selected_exam: primary });
}
