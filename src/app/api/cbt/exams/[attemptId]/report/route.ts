import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { buildAndStoreReport } from "@/lib/exam/build-report";
import { narrateMentorReport } from "@/lib/exam/anthropic-narrate";
import type { MentorAnalysis } from "@/lib/exam/mentor-analysis";

interface ReviewRow {
  question_id: string;
  selected_option: string | null;
  status: string;
  confidence: string | null;
  time_spent_ms: number | null;
  is_correct: boolean | null;
  marks_awarded: number | null;
  questions: {
    question_number: number;
    section: string;
    stem: unknown;
    stem_text: string;
    options: unknown;
    correct_option: string | null;
    solution: unknown;
    solution_text: string;
  } | null;
}

/**
 * GET /api/cbt/exams/[attemptId]/report
 * Returns everything the premium report UI needs: deterministic scores, the
 * MentorAnalysis JSON, the optimal-score gap, any stored narrative, and the
 * question-by-question review. Lazily computes session_results + mentor_reports
 * if a submitted session doesn't have them yet.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  const supabase = createServerSupabaseClient();
  const { attemptId } = await params;

  // Ensure the deterministic report exists (idempotent).
  let { data: result } = await supabase
    .from("session_results")
    .select("*")
    .eq("session_id", attemptId)
    .maybeSingle();

  if (!result) {
    const built = await buildAndStoreReport(supabase, attemptId);
    if (!built.ok) {
      return NextResponse.json(
        { error: `Report unavailable: ${built.reason}` },
        { status: 404 }
      );
    }
    ({ data: result } = await supabase
      .from("session_results")
      .select("*")
      .eq("session_id", attemptId)
      .maybeSingle());
  }

  const { data: report } = await supabase
    .from("mentor_reports")
    .select("analysis, optimal_score, narrative_md, generated_at")
    .eq("session_id", attemptId)
    .maybeSingle();

  // Question-by-question review (test is over — answer key + solution allowed).
  const { data: rows } = await supabase
    .from("responses")
    .select(
      "question_id, selected_option, status, confidence, time_spent_ms, is_correct, marks_awarded, " +
        "questions(question_number, section, stem, stem_text, options, correct_option, solution, solution_text)"
    )
    .eq("session_id", attemptId)
    .returns<ReviewRow[]>();

  const review = (rows ?? [])
    .map((r) => {
      const q = (Array.isArray(r.questions) ? r.questions[0] : r.questions) as
        | Record<string, unknown>
        | null;
      return {
        questionId: r.question_id,
        questionNumber: (q?.question_number as number) ?? 0,
        section: (q?.section as string) ?? "unknown",
        stem: q?.stem ?? [],
        stemText: (q?.stem_text as string) ?? "",
        options: q?.options ?? [],
        correctOption: (q?.correct_option as string) ?? null,
        solution: q?.solution ?? [],
        solutionText: (q?.solution_text as string) ?? "",
        selectedOption: r.selected_option,
        status: r.status,
        confidence: r.confidence,
        timeSpentMs: r.time_spent_ms,
        isCorrect: r.is_correct,
        marksAwarded: r.marks_awarded,
      };
    })
    .sort((a, b) => a.questionNumber - b.questionNumber);

  return NextResponse.json({
    result,
    analysis: report?.analysis ?? null,
    optimalScore: report?.optimal_score ?? null,
    narrative: report?.narrative_md ?? null,
    // Whether the server can produce the (purely additive) LLM narrative at all.
    // When false, the client renders no narrative section — the deterministic
    // report stands alone as the complete report.
    narrationAvailable: !!process.env.ANTHROPIC_API_KEY,
    review,
  });
}

/**
 * POST /api/cbt/exams/[attemptId]/report
 * Generate (and cache) the Claude coaching narrative from the stored analysis.
 * Degrades gracefully: with no ANTHROPIC_API_KEY it returns narrative: null.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  const supabase = createServerSupabaseClient();
  const { attemptId } = await params;

  const { data: report } = await supabase
    .from("mentor_reports")
    .select("analysis, narrative_md")
    .eq("session_id", attemptId)
    .maybeSingle();

  if (!report?.analysis) {
    return NextResponse.json({ error: "No analysis to narrate" }, { status: 404 });
  }
  if (report.narrative_md) {
    return NextResponse.json({ narrative: report.narrative_md });
  }

  const { narrative, degradedReason } = await narrateMentorReport(
    report.analysis as MentorAnalysis
  );

  if (narrative) {
    await supabase
      .from("mentor_reports")
      .update({ narrative_md: narrative })
      .eq("session_id", attemptId);
  }

  return NextResponse.json({ narrative, degraded: degradedReason ?? null });
}
