import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

/**
 * POST /api/cbt/exams/[attemptId]/submit
 * Submit an exam and calculate the final score.
 * Evaluates all answers against correct_answer, computes section breakdown.
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

    // Get all answers for this attempt
    const { data: answers, error: answersError } = await supabase
      .from("attempt_answers")
      .select("*")
      .eq("attempt_id", attemptId);

    if (answersError) {
      return NextResponse.json({ error: answersError.message }, { status: 500 });
    }

    // Get all questions for this attempt
    const questionIds = (answers || []).map((a) => a.question_id);
    const { data: questions, error: questionsError } = await supabase
      .from("validated_questions")
      .select("id, correct_answer, subject")
      .in("id", questionIds);

    if (questionsError) {
      return NextResponse.json({ error: questionsError.message }, { status: 500 });
    }

    const questionMap = new Map(
      (questions || []).map((q) => [q.id, q])
    );

    // Evaluate each answer
    const marksPerQ = attempt.marks_per_question;
    const negMarksPerQ = attempt.negative_marks_per_question;

    let totalAnswered = 0;
    let totalCorrect = 0;
    let totalWrong = 0;
    let totalSkipped = 0;
    let totalMarked = 0;

    // Section breakdown accumulator
    const sectionStats: Record<string, {
      total: number; answered: number; correct: number; wrong: number; skipped: number;
    }> = {};

    const answerUpdates = (answers || []).map((answer) => {
      const question = questionMap.get(answer.question_id);
      if (!question) return null;

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

      if (answer.is_marked_for_review) {
        totalMarked++;
      }

      return {
        id: answer.id,
        is_correct: isCorrect,
        marks_awarded: marksAwarded,
      };
    }).filter(Boolean);

    // Batch update answers
    for (const update of answerUpdates) {
      if (!update) continue;
      await supabase
        .from("attempt_answers")
        .update({
          is_correct: update.is_correct,
          marks_awarded: update.marks_awarded,
          updated_at: new Date().toISOString(),
        })
        .eq("id", update.id);
    }

    // Calculate total score
    const score = (totalCorrect * marksPerQ) - (totalWrong * negMarksPerQ);
    const maxScore = attempt.total_questions * marksPerQ;
    const percentage = maxScore > 0 ? Math.round((score / maxScore) * 10000) / 100 : 0;

    // Build section breakdown
    const sectionBreakdown = Object.entries(sectionStats).map(([subject, stats]) => ({
      subject,
      total: stats.total,
      answered: stats.answered,
      correct: stats.correct,
      wrong: stats.wrong,
      skipped: stats.skipped,
      score: (stats.correct * marksPerQ) - (stats.wrong * negMarksPerQ),
      accuracy: stats.answered > 0
        ? Math.round((stats.correct / stats.answered) * 10000) / 100
        : 0,
    }));

    // Calculate time spent
    const startedAt = new Date(attempt.started_at).getTime();
    const timeSpent = Math.floor((Date.now() - startedAt) / 1000);

    // Update exam attempt
    const { data: updatedAttempt, error: updateError } = await supabase
      .from("exam_attempts")
      .update({
        status: "completed",
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
      .eq("id", attemptId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      attempt_id: attemptId,
      status: "completed",
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
    console.error("Submit exam error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
