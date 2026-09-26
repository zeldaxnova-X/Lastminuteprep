import { NextRequest, NextResponse } from "next/server";
import { loadOwnedAttempt, json403, claimAnonymousAttempts } from "@/lib/auth/api-guard";
import { buildAndStoreReport } from "@/lib/exam/build-report";
import { narrateMentorReport } from "@/lib/exam/anthropic-narrate";
import type { MentorAnalysis } from "@/lib/exam/mentor-analysis";
import { getUserId } from "@/lib/auth/api-guard";
import { resolveReportAccess } from "@/lib/entitlements";
import { contentObjectName } from "@/lib/exam/content-repo";
import { loadExamConfig } from "@/lib/exam/registry";
import { emitEvent } from "@/lib/analytics/events";

/**
 * Remove proprietary methodology from the analysis before it leaves the server
 * (hard rule 4): global calibration thresholds and the blind-guess EV formula
 * artifact. Per-user computed outputs (scores, gains, weakpoints, the personal
 * break-even value) are preserved.
 */
function stripMethodology(analysis: MentorAnalysis | null): MentorAnalysis | null {
  if (!analysis) return null;
  const clone = JSON.parse(JSON.stringify(analysis)) as Record<string, unknown>;
  const calibration = clone.calibration as Record<string, unknown> | undefined;
  if (calibration) delete calibration.thresholds;
  const skip = clone.skipStrategy as Record<string, unknown> | undefined;
  if (skip) delete skip.blindGuessEV;
  return clone as unknown as MentorAnalysis;
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

  // Claim-first: if a signed-in user is opening an anonymous mock they took on
  // this device (e.g. just after signup), attach it to their account NOW so
  // ownership + entitlement resolve deterministically (no race with /auth/me).
  // Idempotent and cheap (a no-op UPDATE when there's nothing to claim).
  const uid = await getUserId();
  if (uid) await claimAnonymousAttempts(uid);

  // Identity + ownership: only the owner (or the sample's device) may fetch a
  // report. The entitlement gate below further restricts WHAT they get.
  const access = await loadOwnedAttempt(attemptId);
  if (!access.ok) return access.res;
  const supabase = access.db;

  // Ensure the deterministic report exists (idempotent).
  let { data: result } = await supabase
    .from("session_results")
    .select("*")
    .eq("session_id", attemptId)
    .maybeSingle();

  const examCode = (access.attempt as { exam_code?: string }).exam_code;
  if (!result) {
    const built = await buildAndStoreReport(supabase, attemptId, examCode);
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
  // MANUAL join: responses is a shared multi-exam table with no FK to any one
  // exam's content, so we can't use PostgREST embedding — fetch the question
  // metadata by id from the exam's content and join in code.
  const { data: respRows } = await supabase
    .from("responses")
    .select("question_id, selected_option, status, confidence, time_spent_ms, is_correct, marks_awarded")
    .eq("session_id", attemptId);

  const reviewQIds = (respRows ?? []).map((r) => r.question_id as string);
  const reviewQMeta = new Map<string, Record<string, unknown>>();
  for (let i = 0; i < reviewQIds.length; i += 500) {
    const chunk = reviewQIds.slice(i, i + 500);
    const { data: qs } = await supabase
      .from(contentObjectName(examCode, "questions"))
      .select("id, question_number, section, stem, stem_text, options, correct_option, solution, solution_text")
      .in("id", chunk);
    for (const q of qs ?? []) reviewQMeta.set(q.id as string, q as Record<string, unknown>);
  }

  const review = (respRows ?? [])
    .map((r) => {
      const q = reviewQMeta.get(r.question_id as string) ?? null;
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
  // ENTITLEMENT GATE (server-side, un-bypassable). The full report is assembled
  // ONLY for an authenticated OWNER who is entitled — All-Access plan OR the ₹9
  // per-attempt unlock. Everyone else (anonymous, signed-in-free without an
  // unlock) gets HEADLINE ONLY: nothing gated is ever put on the wire. See
  // resolveReportAccess. The teaser markets the shape; the values live here.
  // ------------------------------------------------------------------
  const gate = await resolveReportAccess(attemptId, access.attempt.user_id ?? null);
  const viewer = gate.viewer;
  const fullReport = gate.full;
  // The longitudinal cross-mock MarksenseAI (its own /marksense page) stays a
  // plan feature; the ₹9 unlock covers only THIS attempt's report here.
  const mentorAllowed = fullReport;

  // Funnel telemetry: a locked view is a teaser impression. (report_unlocked is
  // emitted at the actual unlock moment in the payment webhook, not per view.)
  if (!fullReport) {
    void emitEvent("report_teaser_viewed", {
      examCode: "ssc-cgl",
      anonymous: !viewer.authenticated,
      userId: viewer.userId,
      props: { attemptId, reason: gate.reason },
    });
  }

  const rawAnalysis = (report?.analysis ?? null) as MentorAnalysis | null;
  // Rule 4: never expose methodology (config thresholds / EV formula artifacts)
  // in an API response. Strip them; keep the per-user computed outputs the report
  // legitimately shows.
  const analysis = stripMethodology(rawAnalysis);
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
  // Max score is exam-specific (SSC 100×2=200, SBI 100×1=100) — read the
  // per-correct mark from the exam's config, never a hardcoded ×2.
  const cfg = await loadExamConfig(supabase, examCode);
  const maxScore = Math.round(totalQuestions * cfg.marksCorrect * 100) / 100;

  return NextResponse.json({
    result,
    plan: viewer.plan,
    // canReport = the caller may see the FULL report for this attempt (plan or ₹9
    // unlock). Kept as the key the results page already branches on.
    canReport: fullReport,
    canMentor: mentorAllowed,
    teaseGain,
    totalQuestions,
    maxScore,
    // Everything below is assembled ONLY when fully entitled — never sent and
    // hidden client-side.
    review: fullReport ? review : [],
    analysis: fullReport ? analysis : null,
    optimalScore: fullReport ? optimalScore : null,
    narrative: fullReport ? (report?.narrative_md ?? null) : null,
    narrationAvailable: fullReport && !!process.env.DEEPSEEK_API_KEY,
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

  // Ownership + entitlement: the narrative is part of the full report, so it
  // requires the same entitlement (All-Access plan OR the ₹9 unlock).
  const uid = await getUserId();
  if (uid) await claimAnonymousAttempts(uid);
  const access = await loadOwnedAttempt(attemptId);
  if (!access.ok) return access.res;
  const supabase = access.db;
  const gate = await resolveReportAccess(attemptId, access.attempt.user_id ?? null);
  if (!gate.full) return json403();

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
