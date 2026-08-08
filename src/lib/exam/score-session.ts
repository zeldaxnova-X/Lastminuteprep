/**
 * Deterministic scoring engine (§5) — the trust core of the product.
 *
 * `scoreSession(session, config)` is PURE: no I/O, no store, no DB. Every
 * marking number comes from the ExamConfig, so a new exam (NEET +4/−1, etc.)
 * scores correctly with zero changes here. A wrong score kills the product, so
 * this module is unit-tested (see score-session.test.ts).
 *
 * Rules encoded exactly:
 *  - A response is EVALUATED only if it is a saved answer: status "answered" or
 *    "answered_marked" with a selected option. "Answered & Marked for Review"
 *    IS counted (§4/§5).
 *  - "Marked for Review" with no saved answer, "not answered", and "not visited"
 *    are SKIPPED — never penalised (un-attempted = 0).
 *  - netScore applies the (negative) wrong-mark from config; rawScore counts
 *    only the positive marks from correct answers.
 */
import {
  type ExamConfig,
  getSection,
  getSectionMarking,
} from "./exam-config";

export type Option = "A" | "B" | "C" | "D";
export type Confidence = "guessed" | "unsure" | "confident";
export type ResponseStatus =
  | "not_visited"
  | "not_answered"
  | "answered"
  | "marked"
  | "answered_marked";

/** One question's outcome, decoupled from the store/DB representation. */
export interface ResponseInput {
  questionId: string;
  /** DB section slug — must match an ExamConfig section key for its marking. */
  section: string;
  selectedOption: Option | null;
  /** The answer key. */
  correctOption: Option | null;
  status: ResponseStatus;
  confidence?: Confidence;
  timeSpentMs?: number;
  /** Optional topic tag (may be null in the current dataset). */
  topic?: string | null;
}

export interface ScoreableSession {
  responses: ResponseInput[];
}

export interface SectionScore {
  key: string;
  name: string;
  total: number;
  attempted: number;
  correct: number;
  wrong: number;
  skipped: number;
  rawScore: number;
  netScore: number;
  /** correct / attempted, in [0,1]; 0 when nothing attempted. */
  accuracy: number;
  /** Mean time per question in the section (ms). */
  avgTimeMs: number;
}

export interface SessionScore {
  rawScore: number;
  netScore: number;
  maxScore: number;
  totalCorrect: number;
  totalWrong: number;
  totalSkipped: number;
  attempted: number;
  total: number;
  /** correct / attempted, in [0,1]; 0 when nothing attempted. */
  accuracy: number;
  sectionBreakdown: SectionScore[];
}

/** A saved answer is the only thing evaluated. Answered & Marked counts (§5). */
export function isEvaluated(r: ResponseInput): boolean {
  return (
    (r.status === "answered" || r.status === "answered_marked") &&
    r.selectedOption != null
  );
}

/** Round to 2 dp to avoid float noise (marks are .5 multiples, so exact). */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

interface Acc {
  key: string;
  name: string;
  total: number;
  attempted: number;
  correct: number;
  wrong: number;
  skipped: number;
  rawScore: number;
  netScore: number;
  timeMs: number;
}

/**
 * Score a session against an exam config. Pure and deterministic.
 * Sections are returned in the config's declared order, with any sections found
 * in the responses but absent from the config appended afterwards.
 */
export function scoreSession(
  session: ScoreableSession,
  config: ExamConfig
): SessionScore {
  const acc = new Map<string, Acc>();

  const ensure = (sectionKey: string): Acc => {
    let a = acc.get(sectionKey);
    if (!a) {
      const cfg = getSection(config, sectionKey);
      a = {
        key: sectionKey,
        name: cfg?.name ?? sectionKey,
        total: 0,
        attempted: 0,
        correct: 0,
        wrong: 0,
        skipped: 0,
        rawScore: 0,
        netScore: 0,
        timeMs: 0,
      };
      acc.set(sectionKey, a);
    }
    return a;
  };

  for (const r of session.responses) {
    const a = ensure(r.section);
    const { correct: markCorrect, wrong: markWrong } = getSectionMarking(
      config,
      r.section
    );

    a.total += 1;
    a.timeMs += r.timeSpentMs ?? 0;

    if (!isEvaluated(r)) {
      a.skipped += 1; // un-attempted or marked-only — never penalised
      continue;
    }

    a.attempted += 1;
    if (r.selectedOption === r.correctOption) {
      a.correct += 1;
      a.rawScore += markCorrect;
      a.netScore += markCorrect;
    } else {
      a.wrong += 1;
      a.netScore += markWrong; // markWrong is signed (negative)
    }
  }

  // Emit sections in config order, then any extras seen in responses.
  const orderedKeys: string[] = [];
  for (const s of [...config.sections].sort((x, y) => x.order - y.order)) {
    if (acc.has(s.key)) orderedKeys.push(s.key);
  }
  for (const key of acc.keys()) {
    if (!orderedKeys.includes(key)) orderedKeys.push(key);
  }

  const sectionBreakdown: SectionScore[] = orderedKeys.map((key) => {
    const a = acc.get(key)!;
    return {
      key: a.key,
      name: a.name,
      total: a.total,
      attempted: a.attempted,
      correct: a.correct,
      wrong: a.wrong,
      skipped: a.skipped,
      rawScore: round2(a.rawScore),
      netScore: round2(a.netScore),
      accuracy: a.attempted > 0 ? a.correct / a.attempted : 0,
      avgTimeMs: a.total > 0 ? Math.round(a.timeMs / a.total) : 0,
    };
  });

  const totals = sectionBreakdown.reduce(
    (t, s) => {
      t.rawScore += s.rawScore;
      t.netScore += s.netScore;
      t.correct += s.correct;
      t.wrong += s.wrong;
      t.skipped += s.skipped;
      t.attempted += s.attempted;
      t.total += s.total;
      return t;
    },
    {
      rawScore: 0,
      netScore: 0,
      correct: 0,
      wrong: 0,
      skipped: 0,
      attempted: 0,
      total: 0,
    }
  );

  // maxScore from the actual responses' sections (robust to partial sessions).
  let maxScore = 0;
  for (const r of session.responses) {
    maxScore += getSectionMarking(config, r.section).correct;
  }

  return {
    rawScore: round2(totals.rawScore),
    netScore: round2(totals.netScore),
    maxScore: round2(maxScore),
    totalCorrect: totals.correct,
    totalWrong: totals.wrong,
    totalSkipped: totals.skipped,
    attempted: totals.attempted,
    total: totals.total,
    accuracy: totals.attempted > 0 ? totals.correct / totals.attempted : 0,
    sectionBreakdown,
  };
}
