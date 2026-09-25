import { NextRequest, NextResponse } from "next/server";
import { loadOwnedAttempt, getUserId, claimAnonymousAttempts } from "@/lib/auth/api-guard";
import { enrichWithRichContent, stripAnswerKey } from "@/lib/cbt-questions";
import { resolveReportAccess } from "@/lib/entitlements";

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

    // Claim-first (idempotent), then ownership.
    const uid = await getUserId();
    if (uid) await claimAnonymousAttempts(uid);
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

    // Enrich with v2 rich content (stem/option blocks + image URLs). Never send
    // the answer key while in progress; and, anti-bypass, never send it for a
    // finished attempt unless the caller is fully entitled to the report (else
    // this resume route would leak the gated key/solutions for a paid attempt).
    const gate = await resolveReportAccess(attemptId, attempt.user_id ?? null);
    let enriched = await enrichWithRichContent(supabase, questions || []);
    if (attempt.status === "in_progress" || !gate.full) enriched = stripAnswerKey(enriched);

    // Build a question map for fast lookup
    const questionMap = new Map(enriched.map((q) => [q.id, q]));

    // Merge answers with their questions, preserving order. Strip per-answer
    // correctness/marks when not fully entitled (it reveals the decision log).
    const answersWithQuestions = (answers || []).map((answer) => {
      const base = gate.full
        ? answer
        : { ...answer, is_correct: null, marks_awarded: null };
      return { ...base, question: questionMap.get(answer.question_id) || null };
    });

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
