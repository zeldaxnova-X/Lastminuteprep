/**
 * Deterministic AI-Mentor analysis (§6a) — the SOURCE OF TRUTH for every number
 * the coach reports. Pure and testable: the LLM (M6) only narrates this JSON and
 * must never compute figures itself.
 *
 * Produces a `MentorAnalysis`:
 *   - confidence calibration (accuracy per Guessed/Unsure/Confident; over/under-
 *     confidence flags)
 *   - attempt-strategy / negative-marking analysis (personalised break-even,
 *     marks lost to poor guessing, questions that should have been skipped)
 *   - optimal achievable score (skip the confidence buckets where attempting is
 *     −EV for THIS student, keep the rest) and the gap vs actual
 *   - time analysis (pacing vs ideal, time sinks, rushed errors)
 *   - section/topic weakness ranking
 *
 * All marking comes from the ExamConfig, so a different exam changes the analysis
 * with zero code edits.
 */
import { type ExamConfig, getSection } from "./exam-config";
import {
  scoreSession,
  isEvaluated,
  type Confidence,
  type Option,
  type ResponseInput,
  type ScoreableSession,
  type SessionScore,
} from "./score-session";

const CONFIDENCE_LEVELS: Confidence[] = ["guessed", "unsure", "confident"];

/** Heuristic thresholds — exposed in the output so the narrator can cite them. */
const OVERCONFIDENCE_ACC = 0.6; // "Confident" accuracy below this = miscalibrated
const UNDERCONFIDENCE_ACC = 0.6; // low-confidence accuracy above this = too cautious
const MIN_BUCKET_FOR_FLAG = 3; // need at least this many to call calibration
const RUSHED_MS = 15_000; // wrong + Confident + faster than this = rushed
const TIME_SINK_MIN_MS = 60_000; // a time sink must exceed this absolute floor
const TIME_SINK_MULTIPLIER = 2; // …and this multiple of the overall average

export interface ConfidenceBucket {
  level: Confidence;
  count: number; // evaluated answers at this confidence
  correct: number;
  wrong: number;
  accuracy: number; // 0..1, 0 when count 0
  netMarks: number; // net contribution of this bucket
}

export interface CalibrationInsight {
  buckets: ConfidenceBucket[];
  overconfident: boolean;
  underconfident: boolean;
  /** Confident-bucket accuracy minus overall accuracy (signed calibration gap). */
  confidenceGap: number;
  thresholds: { overconfidenceAcc: number; underconfidenceAcc: number; minBucket: number };
}

export interface FlaggedQuestion {
  questionId: string;
  section: string;
  confidence: Confidence | null;
  timeMs: number;
  selectedOption: Option | null;
  correctOption: Option | null;
  marksLost?: number;
}

export interface SkipStrategy {
  breakEvenAccuracy: number; // accuracy where attempting turns +EV (config-derived)
  blindGuessEV: number; // EV of a random 1-of-4 guess under this config
  guessed: ConfidenceBucket;
  guessingHelped: boolean; // guess accuracy ≥ break-even
  /** Wrong answers marked Guessed or Unsure — the classic score leak. */
  shouldHaveSkipped: FlaggedQuestion[];
  marksLostShouldHaveSkipped: number;
}

export interface OptimalScore {
  achievableNet: number;
  actualNet: number;
  gain: number; // achievableNet − actualNet
  keptBuckets: Confidence[]; // +EV for this student — attempt these
  droppedBuckets: Confidence[]; // −EV — should have skipped these
}

export interface SectionPacing {
  key: string;
  name: string;
  questionCount: number;
  actualMs: number;
  idealMs: number;
  deltaMs: number; // actual − ideal (positive = over-spent)
}

export interface TimeAnalysis {
  totalTimeMs: number;
  budgetMs: number;
  overallAvgTimeMs: number;
  sectionPacing: SectionPacing[];
  timeSinks: FlaggedQuestion[]; // lots of time AND wrong
  rushedErrors: FlaggedQuestion[]; // very fast, wrong, and "Confident"
  thresholds: { rushedMs: number; timeSinkMs: number };
}

export interface RankedWeakness {
  key: string;
  name: string;
  attempted: number;
  correct: number;
  accuracy: number;
  netScore: number;
  rank: number; // 1 = weakest
}

export interface MentorAnalysis {
  schemaVersion: number;
  score: SessionScore;
  calibration: CalibrationInsight;
  skipStrategy: SkipStrategy;
  optimal: OptimalScore;
  time: TimeAnalysis;
  weakness: { sections: RankedWeakness[]; topics: RankedWeakness[] };
}

/** Marks awarded for a single evaluated response under this config. */
function marksFor(r: ResponseInput, config: ExamConfig): number {
  const sec = getSection(config, r.section);
  const correct = sec?.marksCorrect ?? config.marksCorrect;
  const wrong = sec?.marksWrong ?? config.marksWrong;
  return r.selectedOption === r.correctOption ? correct : wrong;
}

function bucketOf(level: Confidence, rows: ResponseInput[], config: ExamConfig): ConfidenceBucket {
  let count = 0;
  let correct = 0;
  let netMarks = 0;
  for (const r of rows) {
    if ((r.confidence ?? "unsure") !== level) continue;
    count += 1;
    const ok = r.selectedOption === r.correctOption;
    if (ok) correct += 1;
    netMarks += marksFor(r, config);
  }
  return {
    level,
    count,
    correct,
    wrong: count - correct,
    accuracy: count > 0 ? correct / count : 0,
    netMarks: round2(netMarks),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Finer precision for expected-value figures (e.g. 0.125). */
function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/**
 * Build the full deterministic MentorAnalysis. Pure — depends only on the
 * responses and the exam config.
 */
export function analyzeSession(
  session: ScoreableSession,
  config: ExamConfig
): MentorAnalysis {
  const score = scoreSession(session, config);
  const evaluated = session.responses.filter(isEvaluated);

  // ---- Confidence calibration -------------------------------------------
  const buckets = CONFIDENCE_LEVELS.map((lvl) => bucketOf(lvl, evaluated, config));
  const byLevel = new Map(buckets.map((b) => [b.level, b]));
  const confident = byLevel.get("confident")!;
  const unsure = byLevel.get("unsure")!;
  const guessed = byLevel.get("guessed")!;

  const lowConfCount = guessed.count + unsure.count;
  const lowConfCorrect = guessed.correct + unsure.correct;
  const lowConfAccuracy = lowConfCount > 0 ? lowConfCorrect / lowConfCount : 0;

  const overconfident =
    confident.count >= MIN_BUCKET_FOR_FLAG && confident.accuracy < OVERCONFIDENCE_ACC;
  const underconfident =
    lowConfCount >= MIN_BUCKET_FOR_FLAG && lowConfAccuracy > UNDERCONFIDENCE_ACC;

  const calibration: CalibrationInsight = {
    buckets,
    overconfident,
    underconfident,
    confidenceGap: round2(confident.accuracy - score.accuracy),
    thresholds: {
      overconfidenceAcc: OVERCONFIDENCE_ACC,
      underconfidenceAcc: UNDERCONFIDENCE_ACC,
      minBucket: MIN_BUCKET_FOR_FLAG,
    },
  };

  // ---- Attempt strategy / negative marking ------------------------------
  const penalty = Math.abs(config.marksWrong);
  const breakEvenAccuracy = config.marksCorrect + penalty > 0
    ? penalty / (config.marksCorrect + penalty)
    : 0;
  const blindGuessEV = round3(0.25 * config.marksCorrect + 0.75 * config.marksWrong);

  const shouldHaveSkipped: FlaggedQuestion[] = [];
  let marksLostShouldHaveSkipped = 0;
  for (const r of evaluated) {
    const wrong = r.selectedOption !== r.correctOption;
    const lowConf = (r.confidence ?? "unsure") !== "confident";
    if (wrong && lowConf) {
      const sec = getSection(config, r.section);
      const lost = Math.abs(sec?.marksWrong ?? config.marksWrong);
      marksLostShouldHaveSkipped += lost;
      shouldHaveSkipped.push({
        questionId: r.questionId,
        section: r.section,
        confidence: r.confidence ?? "unsure",
        timeMs: r.timeSpentMs ?? 0,
        selectedOption: r.selectedOption,
        correctOption: r.correctOption,
        marksLost: lost,
      });
    }
  }

  const skipStrategy: SkipStrategy = {
    breakEvenAccuracy: round2(breakEvenAccuracy),
    blindGuessEV,
    guessed,
    guessingHelped: guessed.count === 0 ? true : guessed.accuracy >= breakEvenAccuracy,
    shouldHaveSkipped,
    marksLostShouldHaveSkipped: round2(marksLostShouldHaveSkipped),
  };

  // ---- Optimal achievable score -----------------------------------------
  // Keep confidence buckets where the student's own accuracy makes attempting
  // +EV (accuracy ≥ break-even); "skip" the rest. Recompute net on actual
  // outcomes under that rule.
  const keptBuckets: Confidence[] = [];
  const droppedBuckets: Confidence[] = [];
  for (const b of buckets) {
    if (b.count === 0) continue;
    if (b.accuracy >= breakEvenAccuracy) keptBuckets.push(b.level);
    else droppedBuckets.push(b.level);
  }
  let achievableNet = 0;
  for (const r of evaluated) {
    const lvl = r.confidence ?? "unsure";
    if (keptBuckets.includes(lvl)) achievableNet += marksFor(r, config);
  }
  const optimal: OptimalScore = {
    achievableNet: round2(achievableNet),
    actualNet: score.netScore,
    gain: round2(achievableNet - score.netScore),
    keptBuckets,
    droppedBuckets,
  };

  // ---- Time analysis ----------------------------------------------------
  const totalTimeMs = session.responses.reduce((t, r) => t + (r.timeSpentMs ?? 0), 0);
  const budgetMs = config.totalDurationMinutes * 60_000;
  const questionCount = session.responses.length;
  const overallAvgTimeMs = questionCount > 0 ? Math.round(totalTimeMs / questionCount) : 0;
  const timeSinkMs = Math.max(TIME_SINK_MIN_MS, overallAvgTimeMs * TIME_SINK_MULTIPLIER);

  const totalQuestions = score.total || 1;
  const sectionPacing: SectionPacing[] = score.sectionBreakdown.map((s) => {
    const actualMs = s.avgTimeMs * s.total;
    const idealMs = Math.round(budgetMs * (s.total / totalQuestions));
    return {
      key: s.key,
      name: s.name,
      questionCount: s.total,
      actualMs,
      idealMs,
      deltaMs: actualMs - idealMs,
    };
  });

  const timeSinks: FlaggedQuestion[] = [];
  const rushedErrors: FlaggedQuestion[] = [];
  for (const r of evaluated) {
    const wrong = r.selectedOption !== r.correctOption;
    if (!wrong) continue;
    const timeMs = r.timeSpentMs ?? 0;
    const flag: FlaggedQuestion = {
      questionId: r.questionId,
      section: r.section,
      confidence: r.confidence ?? "unsure",
      timeMs,
      selectedOption: r.selectedOption,
      correctOption: r.correctOption,
    };
    if (timeMs >= timeSinkMs) timeSinks.push(flag);
    if ((r.confidence ?? "unsure") === "confident" && timeMs > 0 && timeMs < RUSHED_MS) {
      rushedErrors.push(flag);
    }
  }
  // Deterministic ordering: worst offenders first.
  timeSinks.sort((a, b) => b.timeMs - a.timeMs);
  rushedErrors.sort((a, b) => a.timeMs - b.timeMs);

  const time: TimeAnalysis = {
    totalTimeMs,
    budgetMs,
    overallAvgTimeMs,
    sectionPacing,
    timeSinks,
    rushedErrors,
    thresholds: { rushedMs: RUSHED_MS, timeSinkMs },
  };

  // ---- Weakness ranking -------------------------------------------------
  const sections: RankedWeakness[] = [...score.sectionBreakdown]
    .map((s) => ({
      key: s.key,
      name: s.name,
      attempted: s.attempted,
      correct: s.correct,
      accuracy: s.accuracy,
      netScore: s.netScore,
      rank: 0,
    }))
    // Rank attempted sections by accuracy (weakest first); push un-attempted
    // sections to the end so "what to revise" targets real weaknesses, not skips.
    .sort(
      (a, b) =>
        (a.attempted === 0 ? 1 : 0) - (b.attempted === 0 ? 1 : 0) ||
        a.accuracy - b.accuracy ||
        a.netScore - b.netScore
    )
    .map((s, i) => ({ ...s, rank: i + 1 }));

  const topics = rankTopics(evaluated);

  return {
    schemaVersion: 1,
    score,
    calibration,
    skipStrategy,
    optimal,
    time,
    weakness: { sections, topics },
  };
}

/** Rank topics by accuracy (weakest first). Empty when no topic tags exist. */
function rankTopics(evaluated: ResponseInput[]): RankedWeakness[] {
  const byTopic = new Map<string, { attempted: number; correct: number }>();
  for (const r of evaluated) {
    const topic = r.topic;
    if (!topic) continue;
    const t = byTopic.get(topic) ?? { attempted: 0, correct: 0 };
    t.attempted += 1;
    if (r.selectedOption === r.correctOption) t.correct += 1;
    byTopic.set(topic, t);
  }
  return [...byTopic.entries()]
    .map(([key, t]) => ({
      key,
      name: key,
      attempted: t.attempted,
      correct: t.correct,
      accuracy: t.attempted > 0 ? t.correct / t.attempted : 0,
      netScore: 0,
      rank: 0,
    }))
    .sort((a, b) => a.accuracy - b.accuracy)
    .map((t, i) => ({ ...t, rank: i + 1 }));
}
