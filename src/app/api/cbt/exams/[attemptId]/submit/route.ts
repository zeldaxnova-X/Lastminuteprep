import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadOwnedAttempt } from "@/lib/auth/api-guard";
import { buildAndStoreReport } from "@/lib/exam/build-report";
import { markProfileStale } from "@/lib/ai/build-learner-profile";

type ResponseStatus =
  | "not_visited"
  | "not_answered"
  | "answered"
  | "marked"
  | "answered_marked";

const EXAM_TYPE_TO_MODE: Record<string, string> = {
  previous_year_paper: "pyp",
  subject_test: "subject",
  random_test: "random",
  custom_test: "custom",
};

/** Derive the 5-state response status from the legacy attempt_answers flags. */
function deriveStatus(a: {
  selected_option: string | null;
  is_marked_for_review: boolean | null;
  is_visited: boolean | null;
}): ResponseStatus {
  const answered = !!a.selected_option;
  const marked = !!a.is_marked_for_review;
  if (answered && marked) return "answered_marked";
  if (answered) return "answered";
  if (marked) return "marked";
  if (a.is_visited) return "not_answered";
  return "not_visited";
}

/**
 * Project a finished exam_attempts row + its attempt_answers into the canonical
 * test_sessions + responses tables (§7). Idempotent via upserts.
 */
async function mirrorToCanonical(
  supabase: SupabaseClient,
  attempt: {
    id: string;
    user_id: string;
    exam_type: string;
    started_at: string;
  },
  answers: Array<{
    id: string;
    question_id: string;
    selected_option: string | null;
    is_marked_for_review: boolean | null;
    is_visited: boolean | null;
    confidence: string | null;
    time_spent_seconds: number | null;
    question_index: number | null;
  }>,
  marksById: Map<string, { is_correct: boolean | null; marks_awarded: number }>
) {
  const { data: exam } = await supabase
    .from("exams")
    .select("id")
    .eq("slug", "ssc-cgl-tier-1")
    .single();

  const nowIso = new Date().toISOString();

  await supabase.from("test_sessions").upsert(
    {
      id: attempt.id, // reuse the attempt uuid so URLs/lookups stay 1:1
      user_id: attempt.user_id,
      exam_id: exam?.id ?? null,
      template_id: null,
      mode: EXAM_TYPE_TO_MODE[attempt.exam_type] ?? "custom",
      status: "submitted",
      started_at: attempt.started_at,
      submitted_at: nowIso,
      time_remaining_ms: 0,
      updated_at: nowIso,
    },
    { onConflict: "id" }
  );

  const responseRows = answers.map((a) => {
    const scored = marksById.get(a.id);
    return {
      session_id: attempt.id,
      question_id: a.question_id,
      selected_option: a.selected_option,
      status: deriveStatus(a),
      confidence: a.confidence ?? "unsure",
      time_spent_ms: (a.time_spent_seconds ?? 0) * 1000,
      visit_order: a.question_index != null ? a.question_index + 1 : null,
      is_correct: scored?.is_correct ?? null,
      marks_awarded: scored?.marks_awarded ?? null,
      updated_at: nowIso,
    };
  });

  if (responseRows.length) {
    await supabase
      .from("responses")
      .upsert(responseRows, { onConflict: "session_id,question_id" });
  }
}

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
    const { attemptId } = await params;

    // Identity + ownership before scoring/mutation.
    const access = await loadOwnedAttempt(attemptId);
    if (!access.ok) return access.res;
    const { attempt, db: supabase } = access;

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

    // Keyed by attempt_answers.id for the canonical mirror below.
    const marksAwardedById = new Map(
      answerUpdates.filter(Boolean).map((u) => [u!.id, u!])
    );

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

    // ------------------------------------------------------------------
    // Mirror the finished attempt into the canonical M2 model
    // (test_sessions + responses, incl. confidence) so the scorer (M4) and
    // AI Mentor (M5/M6) read from the spec's §7 tables. Best-effort: a
    // failure here must not break the legacy result path.
    // ------------------------------------------------------------------
    try {
      await mirrorToCanonical(
        supabase,
        attempt as Parameters<typeof mirrorToCanonical>[1],
        answers || [],
        marksAwardedById
      );
      // Deterministic scoring + Mentor analysis → session_results + mentor_reports.
      const report = await buildAndStoreReport(supabase, attempt.id);
      if (!report.ok) console.warn("Report build skipped:", report.reason);

      // MarksenseAI: a new analyzed attempt makes the longitudinal profile
      // stale. Flag it cheaply here (no inline AI call); the dashboard refreshes
      // it on next load. Owner-only; anonymous samples have no profile.
      const ownerId = (attempt as { user_id?: string | null }).user_id ?? null;
      if (ownerId) await markProfileStale(supabase, ownerId);
    } catch (mirrorErr) {
      console.error("Canonical mirror/report failed (non-fatal):", mirrorErr);
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
