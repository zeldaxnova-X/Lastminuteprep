import { NextRequest, NextResponse } from "next/server";
import { getSessionContext, json401 } from "@/lib/auth/api-guard";

/**
 * GET /api/cbt/analytics/revision-queue
 * Get questions the user answered incorrectly, ordered by frequency.
 * This is the "wrong-answer review" / revision queue.
 */
export async function GET(request: NextRequest) {
  try {
    const { user, supabase } = await getSessionContext();
    if (!user) return json401();
    const userId = user.id;
    const { searchParams } = new URL(request.url);

    const subject = searchParams.get("subject");
    const limit = parseInt(searchParams.get("limit") || "50");

    // Get all wrong answers from this user's completed exams
    // Step 1: Get completed attempt IDs
    const { data: attempts } = await supabase
      .from("exam_attempts")
      .select("id")
      .eq("user_id", userId)
      .in("status", ["completed", "auto_submitted"]);

    if (!attempts || attempts.length === 0) {
      return NextResponse.json({
        questions: [],
        total: 0,
      });
    }

    const attemptIds = attempts.map((a) => a.id);

    // Step 2: Get wrong answers grouped by question_id
    const { data: wrongAnswers, error } = await supabase
      .from("attempt_answers")
      .select("question_id, created_at")
      .in("attempt_id", attemptIds)
      .eq("is_correct", false);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Group by question_id and count occurrences
    const wrongCounts: Record<string, { count: number; lastAttempted: string }> = {};
    for (const wa of (wrongAnswers || [])) {
      if (!wrongCounts[wa.question_id]) {
        wrongCounts[wa.question_id] = { count: 0, lastAttempted: wa.created_at };
      }
      wrongCounts[wa.question_id].count++;
      if (wa.created_at > wrongCounts[wa.question_id].lastAttempted) {
        wrongCounts[wa.question_id].lastAttempted = wa.created_at;
      }
    }

    // Sort by frequency (most wrong first)
    const sortedQuestionIds = Object.entries(wrongCounts)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, limit)
      .map(([qId]) => qId);

    if (sortedQuestionIds.length === 0) {
      return NextResponse.json({
        questions: [],
        total: 0,
      });
    }

    // Fetch the actual questions
    let query = supabase
      .from("validated_questions")
      .select("*")
      .in("id", sortedQuestionIds);

    if (subject) {
      query = query.eq("subject", subject);
    }

    const { data: questions, error: qError } = await query;

    if (qError) {
      return NextResponse.json({ error: qError.message }, { status: 500 });
    }

    // Enrich with wrong-count metadata and sort
    const enrichedQuestions = (questions || [])
      .map((q) => ({
        ...q,
        times_wrong: wrongCounts[q.id]?.count || 0,
        last_attempted: wrongCounts[q.id]?.lastAttempted || null,
      }))
      .sort((a, b) => b.times_wrong - a.times_wrong);

    return NextResponse.json({
      questions: enrichedQuestions,
      total: enrichedQuestions.length,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
