import { NextRequest, NextResponse } from "next/server";
import { loadOwnedAttempt } from "@/lib/auth/api-guard";
import { enrichWithRichContent, stripAnswerKey } from "@/lib/cbt-questions";

/**
 * GET /api/cbt/exams/[attemptId]
 * Get exam state for resuming an in-progress attempt.
 * Returns attempt metadata + all answers + questions.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  try {
    const { attemptId } = await params;

    // Identity + ownership: only the owning user (or the anonymous device that
    // created a sample) may read this attempt.
    const access = await loadOwnedAttempt(attemptId);
    if (!access.ok) return access.res;
    const { attempt, db: supabase } = access;

    // Get all answers with their questions
    const { data: answers, error: answersError } = await supabase
      .from("attempt_answers")
      .select("*")
      .eq("attempt_id", attemptId)
      .order("question_index", { ascending: true });

    if (answersError) {
      return NextResponse.json(
        { error: answersError.message },
        { status: 500 }
      );
    }

    // Get all questions for this attempt
    const questionIds = (answers || []).map((a) => a.question_id);
    const { data: questions, error: questionsError } = await supabase
      .from("validated_questions")
      .select("*")
      .in("id", questionIds);

    if (questionsError) {
      return NextResponse.json(
        { error: questionsError.message },
        { status: 500 }
      );
    }

    // Enrich with v2 rich content (stem/option blocks + image URLs). While the
    // attempt is in progress, never send the answer key to the client.
    let enriched = await enrichWithRichContent(supabase, questions || []);
    if (attempt.status === "in_progress") enriched = stripAnswerKey(enriched);

    // Build a question map for fast lookup
    const questionMap = new Map(enriched.map((q) => [q.id, q]));

    // Merge answers with their questions, preserving order
    const answersWithQuestions = (answers || []).map((answer) => ({
      ...answer,
      question: questionMap.get(answer.question_id) || null,
    }));

    // Calculate remaining time
    const startedAt = new Date(attempt.started_at).getTime();
    const elapsed = Math.floor((Date.now() - startedAt) / 1000);
    const timeRemaining = Math.max(0, attempt.time_limit_seconds - elapsed);

    return NextResponse.json({
      attempt,
      answers: answersWithQuestions,
      time_remaining_seconds: timeRemaining,
      is_expired: timeRemaining <= 0 && attempt.status === "in_progress",
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
