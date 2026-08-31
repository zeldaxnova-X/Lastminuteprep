import { NextRequest, NextResponse } from "next/server";
import { loadOwnedAttempt, json403 } from "@/lib/auth/api-guard";
import { getViewer, canSeeReport } from "@/lib/auth/plan";
import { analyzeExamAttempt } from "@/lib/analytics/exam-analyzer";
import type { ExamAttemptInput, QuestionAttemptInput } from "@/lib/analytics/types";
import type { ValidatedQuestion } from "@/types/database.types";

/**
 * GET /api/cbt/analysis/[attemptId]
 * Exposes single source of truth ExamAnalysis object computed dynamically by exam-analyzer.ts.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  try {
    const { attemptId } = await params;

    // Identity + ownership: only the owner (or the sample's device) may analyse.
    const access = await loadOwnedAttempt(attemptId);
    if (!access.ok) return access.res;
    const { attempt, db: supabase } = access;

    // Server-enforced paywall: the detailed attempt analysis is a paid (>= pro)
    // deliverable. A free viewer is denied here, not merely in the UI. The
    // anonymous sample (no session) resolves to `free`, so it is denied too, // the sample's basic result comes from /result, not this deep analysis.
    const viewer = await getViewer();
    if (!canSeeReport(viewer.plan)) return json403();

    // Fetch all attempt answers with joined question metadata
    const { data: answers, error: answersError } = await supabase
      .from("attempt_answers")
      .select("*, question:validated_questions(*)")
      .eq("attempt_id", attemptId)
      .order("question_index", { ascending: true });

    if (answersError) {
      return NextResponse.json({ error: answersError.message }, { status: 500 });
    }

    const questionAttempts: QuestionAttemptInput[] = (answers || []).map((ans, idx) => {
      const q = ans.question as ValidatedQuestion;
      return {
        question: q,
        question_index: ans.question_index ?? idx,
        selected_option: ans.selected_option,
        is_correct: ans.is_correct,
        marks_awarded: ans.marks_awarded || 0,
        time_spent_seconds: ans.time_spent_seconds || 0,
        is_marked_for_review: ans.is_marked_for_review || false,
        is_visited: ans.is_visited || false,
        answer_change_count: ans.answer_change_count || 0,
        initial_option: ans.initial_option || ans.selected_option,
      };
    });

    const attemptInput: ExamAttemptInput = {
      id: attempt.id,
      user_id: attempt.user_id,
      exam_type: attempt.exam_type,
      paper_id: attempt.paper_id,
      title: attempt.title || "SSC CGL Examination",
      total_questions: attempt.total_questions || questionAttempts.length,
      time_limit_seconds: attempt.time_limit_seconds || 3600,
      time_spent_seconds: attempt.time_spent_seconds || 0,
      marks_per_question: attempt.marks_per_question || 2.0,
      negative_marks_per_question: attempt.negative_marks_per_question || 0.5,
      max_score: attempt.max_score || questionAttempts.length * 2.0,
      status: attempt.status,
      created_at: attempt.created_at,
      answers: questionAttempts,
    };

    // Run pure single source of truth analytics orchestrator
    const analysis = analyzeExamAttempt(attemptInput);

    return NextResponse.json(analysis, { status: 200 });
  } catch (err) {
    console.error("GET /api/cbt/analysis error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
