import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

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
    const supabase = createServerSupabaseClient();
    const { attemptId } = await params;

    // Verify attempt exists and is in progress
    const { data: attempt, error: attemptError } = await supabase
      .from("exam_attempts")
      .select("*")
      .eq("id", attemptId)
      .single();

    if (attemptError || !attempt) {
      return NextResponse.json(
        { error: "Exam attempt not found" },
        { status: 404 }
      );
    }

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
      .select("id, correct_answer, subject")
      .in("id", questionIds);

    const questionMap = new Map(
      (questions || []).map((q) => [q.id, q])
    );

    const marksPerQ = attempt.marks_per_question;
    const negMarksPerQ = attempt.negative_marks_per_question;

    let totalAnswered = 0;
    let totalCorrect = 0;
    let totalWrong = 0;
    let totalSkipped = 0;
    let totalMarked = 0;

    const sectionStats: Record<string, {
      total: number; answered: number; correct: number; wrong: number; skipped: number;
    }> = {};

    // Evaluate each answer
    for (const answer of (answers || [])) {
      const question = questionMap.get(answer.question_id);
      if (!question) continue;

      const subject = question.subject;
      if (!sectionStats[subject]) {
        sectionStats[subject] = { total: 0, answered: 0, correct: 0, wrong: 0, skipped: 0 };
      }
      sectionStats[subject].total++;

      let isCorrect: boolean | null = null;
      let marksAwarded = 0;

      if (answer.selected_option) {
        totalAnswered++;
        sectionStats[subject].answered++;

        if (answer.selected_option === question.correct_answer) {
          isCorrect = true;
          marksAwarded = marksPerQ;
          totalCorrect++;
          sectionStats[subject].correct++;
        } else {
          isCorrect = false;
          marksAwarded = -negMarksPerQ;
          totalWrong++;
          sectionStats[subject].wrong++;
        }
      } else {
        totalSkipped++;
        sectionStats[subject].skipped++;
      }

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

    const score = (totalCorrect * marksPerQ) - (totalWrong * negMarksPerQ);
    const maxScore = attempt.total_questions * marksPerQ;
    const percentage = maxScore > 0 ? Math.round((score / maxScore) * 10000) / 100 : 0;

    const sectionBreakdown = Object.entries(sectionStats).map(([subject, stats]) => ({
      subject,
      total: stats.total,
      answered: stats.answered,
      correct: stats.correct,
      wrong: stats.wrong,
      skipped: stats.skipped,
      score: (stats.correct * marksPerQ) - (stats.wrong * negMarksPerQ),
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
