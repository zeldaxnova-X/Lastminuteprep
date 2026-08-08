/**
 * Server-side bridge (§5/§6a): load a submitted session's canonical `responses`
 * (joined to their answer keys), run the pure scorer + mentor analyzer, and
 * persist `session_results` + `mentor_reports.analysis`.
 *
 * The LLM narrative (§6b) is layered on separately in M6 — this only produces
 * the deterministic numbers, and degrades to nothing if the session has no
 * responses yet.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  SSC_CGL_TIER1_CONFIG,
  type ExamConfig,
} from "./exam-config";
import {
  scoreSession,
  type Option,
  type ResponseInput,
  type ResponseStatus,
} from "./score-session";
import { analyzeSession, type MentorAnalysis } from "./mentor-analysis";

interface BuildResult {
  ok: boolean;
  reason?: string;
  analysis?: MentorAnalysis;
}

/** Resolve the ExamConfig for a session, falling back to the SSC config. */
async function loadConfig(
  supabase: SupabaseClient,
  examId: string | null
): Promise<ExamConfig> {
  if (examId) {
    const { data } = await supabase
      .from("exams")
      .select("config")
      .eq("id", examId)
      .single();
    if (data?.config) return data.config as ExamConfig;
  }
  return SSC_CGL_TIER1_CONFIG;
}

/**
 * Score + analyze a submitted session and upsert session_results and
 * mentor_reports. Idempotent; safe to call more than once.
 */
export async function buildAndStoreReport(
  supabase: SupabaseClient,
  sessionId: string
): Promise<BuildResult> {
  const { data: sessionRow } = await supabase
    .from("test_sessions")
    .select("id, exam_id")
    .eq("id", sessionId)
    .single();

  if (!sessionRow) return { ok: false, reason: "session not found" };

  const config = await loadConfig(supabase, sessionRow.exam_id);

  // Responses joined to their question's section / answer key / topic.
  const { data: rows, error } = await supabase
    .from("responses")
    .select(
      "question_id, selected_option, status, confidence, time_spent_ms, questions(section, correct_option, topic)"
    )
    .eq("session_id", sessionId);

  if (error) return { ok: false, reason: error.message };
  if (!rows || rows.length === 0) return { ok: false, reason: "no responses" };

  const responses: ResponseInput[] = rows.map((row) => {
    const q = (Array.isArray(row.questions) ? row.questions[0] : row.questions) as
      | { section: string | null; correct_option: string | null; topic: string | null }
      | null;
    return {
      questionId: row.question_id as string,
      section: q?.section ?? "unknown",
      selectedOption: (row.selected_option as Option | null) ?? null,
      correctOption: (q?.correct_option as Option | null) ?? null,
      status: row.status as ResponseStatus,
      confidence: (row.confidence as ResponseInput["confidence"]) ?? "unsure",
      timeSpentMs: (row.time_spent_ms as number | null) ?? 0,
      topic: q?.topic ?? null,
    };
  });

  const session = { responses };
  const score = scoreSession(session, config);
  const analysis = analyzeSession(session, config);

  await supabase.from("session_results").upsert(
    {
      session_id: sessionId,
      raw_score: score.rawScore,
      net_score: score.netScore,
      correct: score.totalCorrect,
      wrong: score.totalWrong,
      skipped: score.totalSkipped,
      attempted: score.attempted,
      accuracy: Math.round(score.accuracy * 10000) / 100, // percentage
      section_breakdown: score.sectionBreakdown,
    },
    { onConflict: "session_id" }
  );

  await supabase.from("mentor_reports").upsert(
    {
      session_id: sessionId,
      analysis,
      optimal_score: analysis.optimal.achievableNet,
      // narrative_md is added by the M6 LLM step; leave untouched here.
      generated_at: new Date().toISOString(),
    },
    { onConflict: "session_id" }
  );

  return { ok: true, analysis };
}
