/**
 * Per-user topic mastery, derived LIVE from the answer log joined to the freshly
 * tagged question bank (`questions.topic`). This is what makes topic-level weak/
 * strong analysis real: it reads every answered question across all of a user's
 * completed attempts, so it works retroactively (no need to re-run old mocks)
 * the moment the bank is classified. The frozen `mentor_reports.analysis.topics`
 * predate topic tags and are empty, so we compute topics here instead.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { TopicSignal } from "./learner-signals";

const WEAK_MAX_PCT = 65;
const STRONG_MIN_PCT = 75;
const MIN_ATTEMPTED = 3; // enough exposure to be a real signal, not a one-off

export interface DerivedTopicSignals {
  weak: TopicSignal[];
  strong: TopicSignal[];
  all: TopicSignal[];
}

/**
 * Aggregate the user's answered questions into per-topic accuracy. Returns null
 * when there is no completed attempt / answer data yet.
 */
export async function loadTopicSignals(
  db: SupabaseClient,
  userId: string
): Promise<DerivedTopicSignals | null> {
  const { data: attempts } = await db
    .from("exam_attempts")
    .select("id")
    .eq("user_id", userId)
    .in("status", ["completed", "auto_submitted"]);
  if (!attempts || attempts.length === 0) return null;
  const attemptIds = attempts.map((a) => a.id as string);

  const { data: answers } = await db
    .from("attempt_answers")
    .select("attempt_id, question_id, is_correct")
    .in("attempt_id", attemptIds);
  if (!answers || answers.length === 0) return null;

  // Map each answered question to its topic/section (chunked to keep the IN small).
  const qids = [...new Set(answers.map((a) => a.question_id as string))];
  const meta = new Map<string, { topic: string; section: string }>();
  for (let i = 0; i < qids.length; i += 800) {
    const chunk = qids.slice(i, i + 800);
    const { data: qs } = await db
      .from("questions")
      .select("id, topic, section")
      .in("id", chunk);
    for (const q of qs ?? []) {
      if (q.topic) meta.set(q.id as string, { topic: q.topic as string, section: (q.section as string) ?? "" });
    }
  }

  const agg = new Map<
    string,
    { topic: string; section: string; attempted: number; correct: number; attemptSet: Set<string> }
  >();
  for (const a of answers) {
    const m = meta.get(a.question_id as string);
    if (!m) continue;
    const answered = a.is_correct !== null && a.is_correct !== undefined; // skipped => not attempted
    const cur =
      agg.get(m.topic) ??
      { topic: m.topic, section: m.section, attempted: 0, correct: 0, attemptSet: new Set<string>() };
    cur.attemptSet.add(a.attempt_id as string);
    if (answered) {
      cur.attempted += 1;
      if (a.is_correct === true) cur.correct += 1;
    }
    agg.set(m.topic, cur);
  }

  const round1 = (n: number) => Math.round(n * 10) / 10;
  const all: TopicSignal[] = [...agg.values()]
    .filter((v) => v.attempted >= MIN_ATTEMPTED)
    .map((v) => ({
      topic: v.topic,
      attempted: v.attempted,
      correct: v.correct,
      accuracyPct: round1((v.correct / v.attempted) * 100),
      appearedInAttempts: v.attemptSet.size,
      section: v.section,
    }));

  const weak = [...all]
    .filter((t) => t.accuracyPct < WEAK_MAX_PCT)
    .sort((a, b) => a.accuracyPct - b.accuracyPct || b.attempted - a.attempted)
    .slice(0, 8);
  const strong = [...all]
    .filter((t) => t.accuracyPct >= STRONG_MIN_PCT)
    .sort((a, b) => b.accuracyPct - a.accuracyPct || b.attempted - a.attempted)
    .slice(0, 5);

  return { weak, strong, all };
}
