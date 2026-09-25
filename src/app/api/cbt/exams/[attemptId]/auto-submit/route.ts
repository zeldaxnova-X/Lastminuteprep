import { NextRequest, NextResponse } from "next/server";
import { loadOwnedAttempt } from "@/lib/auth/api-guard";
import { loadExamConfig } from "@/lib/exam/registry";
import { getSectionMarking } from "@/lib/exam/exam-config";

/**
 * POST /api/cbt/exams/[attemptId]/auto-submit
 * Auto-submit an exam when the timer expires.
 * Same scoring logic as manual submit but sets status to 'auto_submitted'.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  try {
    const { attemptId } = await params;

    // Identity + ownership before auto-submitting.
    const access = await loadOwnedAttempt(attemptId);
    if (!access.ok) return access.res;
    const { attempt, db: supabase } = access;

    if (attempt.status !== "in_progress") {
      return NextResponse.json(
        { error: "Exam is already submitted" },
        { status: 400 }
      );
    }

    // Get all answers
    const { data: answers } = await supabase
      .from("attempt_answers")
      .select("*")
      .eq("attempt_id", attemptId);

    // Get all questions
    const questionIds = (answers || []).map((a) => a.question_id);
    const { data: questions } = await supabase
      .from("validated_questions")
      .select("id, correct_answer, subject, section_slug")
      .in("id", questionIds);

    const questionMap = new Map(
      (questions || []).map((q) => [q.id, q])
    );

    // Per-section marking from the exam config (never a hardcoded scalar).
    const config = await loadExamConfig(supabase, attempt.exam_code);

    let totalAnswered = 0;
    let totalCorrect = 0;
    let totalWrong = 0;
    let totalSkipped = 0;
    let totalMarked = 0;
    let maxScore = 0;

    const sectionStats: Record<string, {
      total: number; answered: number; correct: number; wrong: number; skipped: number; score: number;
    }> = {};

    // Evaluate each answer
    for (const answer of (answers || [])) {
      const question = questionMap.get(answer.question_id);
      if (!question) continue;

      const subject = question.subject;
      const slug = (question as { section_slug?: string }).section_slug || subject;
      const { correct: markCorrect, wrong: markWrong } = getSectionMarking(config, slug);
      maxScore += markCorrect;

      if (!sectionStats[subject]) {
        sectionStats[subject] = { total: 0, answered: 0, correct: 0, wrong: 0, skipped: 0, score: 0 };
      }
      const st = sectionStats[subject];
      st.total++;

      let isCorrect: boolean | null = null;
      let marksAwarded = 0;

      if (answer.selected_option) {
        totalAnswered++;
        st.answered++;

        if (answer.selected_option === question.correct_answer) {
          isCorrect = true;
          marksAwarded = markCorrect;
          totalCorrect++;
          st.correct++;
        } else {
          isCorrect = false;
          marksAwarded = markWrong;
          totalWrong++;
          st.wrong++;
        }
      } else {
        totalSkipped++;
        st.skipped++;
      }
      st.score += marksAwarded;

      if (answer.is_marked_for_review) totalMarked++;

      await supabase
        .from("attempt_answers")
        .update({
          is_correct: isCorrect,
          marks_awarded: marksAwarded,
          updated_at: new Date().toISOString(),
        })
        .eq("id", answer.id);
    }

    const score = Math.round(Object.values(sectionStats).reduce((s, st) => s + st.score, 0) * 100) / 100;
    const percentage = maxScore > 0 ? Math.round((score / maxScore) * 10000) / 100 : 0;

    const sectionBreakdown = Object.entries(sectionStats).map(([subject, stats]) => ({
      subject,
      total: stats.total,
      answered: stats.answered,
      correct: stats.correct,
      wrong: stats.wrong,
      skipped: stats.skipped,
      score: Math.round(stats.score * 100) / 100,
      accuracy: stats.answered > 0 ? Math.round((stats.correct / stats.answered) * 10000) / 100 : 0,
    }));

    const timeSpent = attempt.time_limit_seconds; // Auto-submit means full time used

    await supabase
      .from("exam_attempts")
      .update({
        status: "auto_submitted",
        total_answered: totalAnswered,
        total_correct: totalCorrect,
        total_wrong: totalWrong,
        total_skipped: totalSkipped,
        total_marked_for_review: totalMarked,
        score,
        max_score: maxScore,
        percentage,
        section_breakdown: sectionBreakdown,
        submitted_at: new Date().toISOString(),
        time_spent_seconds: timeSpent,
        updated_at: new Date().toISOString(),
      })
      .eq("id", attemptId);

    return NextResponse.json({
      attempt_id: attemptId,
      status: "auto_submitted",
      total_answered: totalAnswered,
      total_correct: totalCorrect,
      total_wrong: totalWrong,
      total_skipped: totalSkipped,
      score,
      max_score: maxScore,
      percentage,
      section_breakdown: sectionBreakdown,
      time_spent_seconds: timeSpent,
    });
  } catch (err) {
    console.error("Auto-submit error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
