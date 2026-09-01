/**
 * Longitudinal learner signals: a deterministic roll-up of EVERY completed
 * mock a user has done into one compact object. This is the numeric source of
 * truth the AI profile narrates; the model never recomputes these figures.
 *
 * Pure aggregation lives in `aggregateSignals`; `loadLearnerSignals` is the
 * thin DB adapter (service-role client) that feeds it. Kept dependency-light so
 * the aggregation is unit-testable without a database.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MentorAnalysis } from "@/lib/exam/mentor-analysis";

/** A topic counts as a weakpoint below this accuracy, a strength at/above STRONG. */
const WEAK_MAX_PCT = 65;
const STRONG_MIN_PCT = 75;

export interface AttemptDatum {
  id: string;
  createdAt: string;
  analysis: MentorAnalysis;
}

export interface SectionSignal {
  name: string;
  attempts: number;
  accuracyPct: number; // aggregate correct/attempted across all mocks
  latestAccuracyPct: number;
  trendPct: number; // slope of accuracy over attempt index (+ improving)
  avgNet: number;
}

export interface TopicSignal {
  topic: string;
  attempted: number;
  correct: number;
  accuracyPct: number;
  appearedInAttempts: number; // recurrence, the chronic weakness signal
}

export interface LearnerSignals {
  attemptsAnalyzed: number;
  firstAttemptAt: string | null;
  lastAttemptAt: string | null;
  score: {
    firstNet: number;
    latestNet: number;
    bestNet: number;
    avgNet: number;
    maxScore: number;
    trendPerAttempt: number; // linear slope of net over attempt index
  };
  accuracy: { overallPct: number; latestPct: number; trendPct: number };
  sections: SectionSignal[];
  topicWeakpoints: TopicSignal[]; // weakest recurring topics (asc accuracy)
  topicStrengths: TopicSignal[]; // strongest recurring topics (desc accuracy)
  tendencies: {
    calibration: "overconfident" | "underconfident" | "balanced" | "unknown";
    overconfidentCount: number;
    underconfidentCount: number;
    avgMarksLostToBadGuessing: number;
    avgOptimalGain: number; // avg marks left on the table via poor skips
    pacing: "rushing" | "over-spending" | "balanced" | "unknown";
  };
  consistency: {
    netStdDev: number;
    label: "steady" | "volatile" | "improving" | "declining";
  };
}

/** Least-squares slope of y over its own index (0..n-1). 0 for <2 points. */
function slope(ys: number[]): number {
  const n = ys.length;
  if (n < 2) return 0;
  const meanX = (n - 1) / 2;
  const meanY = ys.reduce((s, y) => s + y, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - meanX) * (ys[i] - meanY);
    den += (i - meanX) ** 2;
  }
  return den === 0 ? 0 : num / den;
}

function round(n: number, dp = 1): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

/** Aggregate attempts (chronological) into longitudinal signals. */
export function aggregateSignals(attempts: AttemptDatum[]): LearnerSignals {
  const n = attempts.length;
  const nets = attempts.map((a) => a.analysis.score.netScore ?? 0);
  const accs = attempts.map((a) => (a.analysis.score.accuracy ?? 0) * 100);
  const maxScore = attempts.at(-1)?.analysis.score.maxScore ?? 0;

  const avgNet = n ? nets.reduce((s, v) => s + v, 0) / n : 0;
  const netStdDev = n
    ? Math.sqrt(nets.reduce((s, v) => s + (v - avgNet) ** 2, 0) / n)
    : 0;

  // --- Sections: aggregate + latest + trend across attempts ---------------
  const secAgg = new Map<
    string,
    { correct: number; attempted: number; nets: number[]; accs: number[] }
  >();
  for (const a of attempts) {
    for (const s of a.analysis.weakness.sections) {
      const cur = secAgg.get(s.name) ?? {
        correct: 0,
        attempted: 0,
        nets: [],
        accs: [],
      };
      cur.correct += s.correct;
      cur.attempted += s.attempted;
      cur.nets.push(s.netScore);
      if (s.attempted > 0) cur.accs.push(s.accuracy * 100);
      secAgg.set(s.name, cur);
    }
  }
  const sections: SectionSignal[] = [...secAgg.entries()]
    .map(([name, v]) => ({
      name,
      attempts: v.accs.length,
      accuracyPct: v.attempted ? round((v.correct / v.attempted) * 100) : 0,
      latestAccuracyPct: round(v.accs.at(-1) ?? 0),
      trendPct: round(slope(v.accs)),
      avgNet: round(v.nets.reduce((s, x) => s + x, 0) / (v.nets.length || 1)),
    }))
    .sort((x, y) => x.accuracyPct - y.accuracyPct);

  // --- Topics: recurrence-weighted mastery --------------------------------
  const topicAgg = new Map<
    string,
    { correct: number; attempted: number; appearances: number }
  >();
  for (const a of attempts) {
    for (const t of a.analysis.weakness.topics) {
      if (!t.name || t.attempted <= 0) continue;
      const cur = topicAgg.get(t.name) ?? {
        correct: 0,
        attempted: 0,
        appearances: 0,
      };
      cur.correct += t.correct;
      cur.attempted += t.attempted;
      cur.appearances += 1;
      topicAgg.set(t.name, cur);
    }
  }
  const topics: TopicSignal[] = [...topicAgg.entries()]
    .map(([topic, v]) => ({
      topic,
      attempted: v.attempted,
      correct: v.correct,
      accuracyPct: round((v.correct / v.attempted) * 100),
      appearedInAttempts: v.appearances,
    }))
    // Enough exposure to be a real signal, not a one-off.
    .filter((t) => t.attempted >= 3);
  // A topic is only a weakpoint if accuracy is actually low, and only a strength
  // if it is actually high. Without these bounds a tiny topic set (or a strong
  // student) would surface aced topics as "weakpoints" and vice versa.
  const topicWeakpoints = [...topics]
    .filter((t) => t.accuracyPct < WEAK_MAX_PCT)
    .sort((a, b) => a.accuracyPct - b.accuracyPct || b.attempted - a.attempted)
    .slice(0, 8);
  const topicStrengths = [...topics]
    .filter((t) => t.accuracyPct >= STRONG_MIN_PCT)
    .sort((a, b) => b.accuracyPct - a.accuracyPct || b.attempted - a.attempted)
    .slice(0, 5);

  // --- Tendencies ---------------------------------------------------------
  let over = 0;
  let under = 0;
  let badGuessMarks = 0;
  let optimalGain = 0;
  let overSpend = 0;
  let rush = 0;
  for (const a of attempts) {
    if (a.analysis.calibration.overconfident) over++;
    if (a.analysis.calibration.underconfident) under++;
    badGuessMarks += a.analysis.skipStrategy.marksLostShouldHaveSkipped ?? 0;
    optimalGain += a.analysis.optimal.gain ?? 0;
    overSpend += a.analysis.time.timeSinks.length;
    rush += a.analysis.time.rushedErrors.length;
  }
  const calibration: LearnerSignals["tendencies"]["calibration"] =
    n === 0
      ? "unknown"
      : over > under && over >= Math.ceil(n / 3)
        ? "overconfident"
        : under > over && under >= Math.ceil(n / 3)
          ? "underconfident"
          : "balanced";
  const pacing: LearnerSignals["tendencies"]["pacing"] =
    n === 0
      ? "unknown"
      : overSpend > rush * 2 && overSpend >= n
        ? "over-spending"
        : rush > overSpend * 2 && rush >= n
          ? "rushing"
          : "balanced";

  // --- Consistency label --------------------------------------------------
  const netTrend = slope(nets);
  const consistencyLabel: LearnerSignals["consistency"]["label"] =
    n < 2
      ? "steady"
      : netTrend >= 2
        ? "improving"
        : netTrend <= -2
          ? "declining"
          : netStdDev > 12
            ? "volatile"
            : "steady";

  return {
    attemptsAnalyzed: n,
    firstAttemptAt: attempts[0]?.createdAt ?? null,
    lastAttemptAt: attempts.at(-1)?.createdAt ?? null,
    score: {
      firstNet: round(nets[0] ?? 0),
      latestNet: round(nets.at(-1) ?? 0),
      bestNet: round(nets.length ? Math.max(...nets) : 0),
      avgNet: round(avgNet),
      maxScore: round(maxScore),
      trendPerAttempt: round(netTrend),
    },
    accuracy: {
      overallPct: round(accs.reduce((s, v) => s + v, 0) / (n || 1)),
      latestPct: round(accs.at(-1) ?? 0),
      trendPct: round(slope(accs)),
    },
    sections,
    topicWeakpoints,
    topicStrengths,
    tendencies: {
      calibration,
      overconfidentCount: over,
      underconfidentCount: under,
      avgMarksLostToBadGuessing: round(badGuessMarks / (n || 1)),
      avgOptimalGain: round(optimalGain / (n || 1)),
      pacing,
    },
    consistency: { netStdDev: round(netStdDev), label: consistencyLabel },
  };
}

/**
 * Load every completed attempt's stored MentorAnalysis for a user (chronological)
 * and aggregate. Returns null when there is nothing analyzed yet.
 */
export async function loadLearnerSignals(
  supabase: SupabaseClient,
  userId: string
): Promise<LearnerSignals | null> {
  // Completed attempts, oldest first. session_id in mentor_reports === attempt.id.
  const { data: attempts } = await supabase
    .from("exam_attempts")
    .select("id, created_at")
    .eq("user_id", userId)
    .in("status", ["completed", "auto_submitted"])
    .order("created_at", { ascending: true });

  if (!attempts || attempts.length === 0) return null;

  const ids = attempts.map((a) => a.id as string);
  const { data: reports } = await supabase
    .from("mentor_reports")
    .select("session_id, analysis")
    .in("session_id", ids);

  const byId = new Map<string, MentorAnalysis>();
  for (const r of reports ?? []) {
    if (r.analysis) byId.set(r.session_id as string, r.analysis as MentorAnalysis);
  }

  const data: AttemptDatum[] = attempts
    .filter((a) => byId.has(a.id as string))
    .map((a) => ({
      id: a.id as string,
      createdAt: a.created_at as string,
      analysis: byId.get(a.id as string)!,
    }));

  if (data.length === 0) return null;
  return aggregateSignals(data);
}

/** Cheap fingerprint for staleness: changes when a new attempt is analyzed. */
export function signalsHash(s: LearnerSignals): string {
  return `${s.attemptsAnalyzed}:${s.lastAttemptAt ?? ""}:${s.score.latestNet}`;
}
