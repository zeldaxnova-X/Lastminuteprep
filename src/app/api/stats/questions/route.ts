import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { countBankQuestions } from "@/lib/stats";

/**
 * GET /api/stats/questions
 * Public, live count of questions in the bank. Powers the landing-page metric
 * so the number reflects the real dataset and moves as questions are added.
 * Cached briefly at the edge; the landing page also polls this to update an
 * already-open tab.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = createServerSupabaseClient();
    // Count across every live exam (SSC + SBI + IBPS + …), not just the default.
    const questions = await countBankQuestions(supabase);

    return NextResponse.json(
      { questions },
      {
        headers: {
          "Cache-Control": "public, max-age=30, s-maxage=30, stale-while-revalidate=120",
        },
      }
    );
  } catch {
    return NextResponse.json({ error: "stats_unavailable" }, { status: 500 });
  }
}
