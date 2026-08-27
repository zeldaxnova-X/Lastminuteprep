import { NextResponse } from "next/server";
import { getSessionContext, json401 } from "@/lib/auth/api-guard";

/**
 * GET /api/cbt/analytics/coverage
 * Per-user question-bank coverage: how many unique exam-eligible questions the
 * user has done (answered, or been served in a finished test) vs how many
 * remain, overall and per subject. Backed by the `cbt_user_coverage` SQL fn so
 * the "done/remaining" math matches the unique-question picker exactly.
 */
export async function GET() {
  try {
    const { user, supabase } = await getSessionContext();
    if (!user) return json401();

    const { data, error } = await supabase.rpc("cbt_user_coverage", { p_user: user.id });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const bySubject = (data as { subject: string; total: number; done: number; remaining: number }[]) || [];
    const overall = bySubject.reduce(
      (acc, r) => ({
        total: acc.total + Number(r.total),
        done: acc.done + Number(r.done),
        remaining: acc.remaining + Number(r.remaining),
      }),
      { total: 0, done: 0, remaining: 0 }
    );

    return NextResponse.json({ overall, by_subject: bySubject });
  } catch (err) {
    console.error("Coverage error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
