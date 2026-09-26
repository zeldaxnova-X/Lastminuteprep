/**
 * Server-side bridge (§5/§6a): load a submitted session's canonical `responses`
 * (joined to their answer keys), run the pure scorer + mentor analyzer, and
 * persist `session_results` + `mentor_reports.analysis`.
 *
 * The LLM narrative (§6b) is layered on separately in M6, this only produces
 * the deterministic numbers, and degrades to nothing if the session has no
 * responses yet.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  scoreSession,
  type Option,
  type ResponseInput,
  type ResponseStatus,
} from "./score-session";
import { analyzeSession, type MentorAnalysis } from "./mentor-analysis";
import { loadExamConfig, DEFAULT_EXAM_CODE } from "./registry";
import { contentObjectName } from "./content-repo";

interface BuildResult {
  ok: boolean;
  reason?: string;
  analysis?: MentorAnalysis;
}

/**
 * Score + analyze a submitted session and upsert session_results and
 * mentor_reports. Idempotent; safe to call more than once. `examCode` scopes the
 * config AND the content namespace the question metadata is read from, so an
 * SBI report is scored with SBI's rules and reads only SBI content.
 */
export async function buildAndStoreReport(
  supabase: SupabaseClient,
  sessionId: string,
  examCode: string = DEFAULT_EXAM_CODE
): Promise<BuildResult> {
  const { data: sessionRow } = await supabase
    .from("test_sessions")
    .select("id, exam_id")
    .eq("id", sessionId)
    .single();

  if (!sessionRow) return { ok: false, reason: "session not found" };

  const config = await loadExamConfig(supabase, examCode);
  const questionsObject = contentObjectName(examCode, "questions");

  // Responses + their question metadata via a MANUAL join. We can't use
  // PostgREST embedding (responses→questions) because responses is a shared,
  // multi-exam table with no FK to any one exam's content table. Fetch the
  // question metadata by id from the exam's content and join in code.
  const { data: rows, error } = await supabase
    .from("responses")
    .select("question_id, selected_option, status, confidence, time_spent_ms")
    .eq("session_id", sessionId);

  if (error) return { ok: false, reason: error.message };
  if (!rows || rows.length === 0) return { ok: false, reason: "no responses" };

  const qids = rows.map((r) => r.question_id as string);
  const qMeta = new Map<string, { section: string | null; correct_option: string | null; topic: string | null }>();
  for (let i = 0; i < qids.length; i += 500) {
    const chunk = qids.slice(i, i + 500);
    const { data: qs } = await supabase
      .from(questionsObject)
      .select("id, section, correct_option, topic")
      .in("id", chunk);
    for (const q of qs ?? []) {
      qMeta.set(q.id as string, {
        section: (q.section as string | null) ?? null,
        correct_option: (q.correct_option as string | null) ?? null,
        topic: (q.topic as string | null) ?? null,
      });
    }
  }

  const responses: ResponseInput[] = rows.map((row) => {
    const q = qMeta.get(row.question_id as string) ?? null;
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
