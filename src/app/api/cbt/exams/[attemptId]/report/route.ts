import { NextRequest, NextResponse } from "next/server";
import { loadOwnedAttempt, json403 } from "@/lib/auth/api-guard";
import { buildAndStoreReport } from "@/lib/exam/build-report";
import { narrateMentorReport } from "@/lib/exam/anthropic-narrate";
import type { MentorAnalysis } from "@/lib/exam/mentor-analysis";
import { getViewer, canSeeReport, canSeeMentor } from "@/lib/auth/plan";

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
  const { attemptId } = await params;

  // Identity + ownership: only the owner (or the sample's device) may fetch a
  // report. The paywall below further restricts WHAT they get by plan.
  const access = await loadOwnedAttempt(attemptId);
  if (!access.ok) return access.res;
  const supabase = access.db;

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

  // Question-by-question review (test is over, answer key + solution allowed).
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

  // ------------------------------------------------------------------
  // PAYWALL SEAM (M9). Gate the report by the viewer's plan:
  //   free   → net score + section breakdown + a blurred "+X" tease only
  //            (the conversion screen shows these, values masked client-side).
  //   pro    → full deterministic report (review), NO Mentor engine.
  //   mentor → everything, incl. analysis + narrative.
  // Session ownership isn't enforced yet (sessions still use permissive RLS +
  // service role). // TODO: check session.user_id === viewer.userId once the
  // anonymous sample sessions are claimed at first login.
  // ------------------------------------------------------------------
  const viewer = await getViewer();
  const reportAllowed = canSeeReport(viewer.plan);
  const mentorAllowed = canSeeMentor(viewer.plan);

  const analysis = (report?.analysis ?? null) as MentorAnalysis | null;
  const netScore = (result as { net_score?: number } | null)?.net_score ?? 0;
  const optimalScore = report?.optimal_score ?? null;
  // The single "+X marks" figure, always returned so the conversion screen can
  // blur-tease it without exposing the rest of the Mentor analysis.
  const teaseGain =
    (analysis?.optimal?.gain as number | undefined) ??
    (optimalScore != null ? Math.max(0, Math.round(optimalScore - netScore)) : 0);

  const r = result as {
    correct?: number;
    wrong?: number;
    skipped?: number;
  } | null;
  const totalQuestions = (r?.correct ?? 0) + (r?.wrong ?? 0) + (r?.skipped ?? 0);

  return NextResponse.json({
    result,
    plan: viewer.plan,
    canReport: reportAllowed,
    canMentor: mentorAllowed,
    teaseGain,
    totalQuestions,
    maxScore: totalQuestions * 2,
    // Full-report data, only for plan >= pro.
    review: reportAllowed ? review : [],
    // Mentor engine, only for plan == mentor.
    analysis: mentorAllowed ? analysis : null,
    optimalScore: mentorAllowed ? optimalScore : null,
    narrative: mentorAllowed ? (report?.narrative_md ?? null) : null,
    // Whether the server can produce the (purely additive) LLM narrative at all.
    narrationAvailable: mentorAllowed && !!process.env.DEEPSEEK_API_KEY,
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
  const { attemptId } = await params;

  // Ownership + paywall: the Mentor narrative is a mentor-plan feature.
  const access = await loadOwnedAttempt(attemptId);
  if (!access.ok) return access.res;
  const supabase = access.db;
  const viewer = await getViewer();
  if (!canSeeMentor(viewer.plan)) return json403();

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
