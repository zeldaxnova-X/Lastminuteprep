/**
 * ExamConfig — the single source of truth for an exam's rules (§1).
 *
 * DESIGN RULE: the scorer (M4) and mentor (M5/M6) READ every marking number,
 * duration, and section shape from a config object that ultimately comes from
 * the `exams.config` jsonb row. Nothing SSC-specific is hardcoded in the engine.
 * Adding NEET/JEE/CHSL later = inserting a new `exams` row with a new config;
 * zero engine edits (that is the acceptance test for §2).
 *
 * This file also exports the canonical SSC CGL Tier 1 config. It must stay in
 * sync with the seed in
 *   supabase/migrations/20260805000000_m2_exam_config_and_session_model.sql
 * (same JSON). Keep both in lockstep when either changes.
 */

/** DB `questions.section` slug values — sections join on these. */
export type SectionKey =
  | "reasoning"
  | "general_awareness"
  | "quantitative_aptitude"
  | "english_comprehension";

/**
 * Question types the engine may support. Only single-correct MCQ is fully
 * implemented now (SSC); the others are stubbed so future configs can declare
 * them without breaking the type surface.
 */
export type QuestionType =
  | "single_correct_mcq"
  | "numerical" // JEE numerical-answer — STUB
  | "optional_n_of_m"; // NEET "attempt N of M" — STUB

export interface SectionConfig {
  /** Must equal the DB `questions.section` slug so questions can be selected. */
  key: string;
  /** Human-readable section name. */
  name: string;
  /** 1-based position in the fixed section order. */
  order: number;
  /** Number of questions drawn for this section. */
  questionCount: number;
  /** Marks for a correct answer in this section (e.g. SSC = +2, JEE = +4). */
  marksCorrect: number;
  /** Marks for a wrong answer, stored SIGNED (e.g. SSC = −0.5, none = 0). */
  marksWrong: number;
  /** Question type for this section. */
  questionType: QuestionType;
  /** Per-section time lock in minutes; null = governed by the exam-wide timer. */
  timeLimitMinutes: number | null;
  /** For `optional_n_of_m`: how many of the `questionCount` must be attempted. STUB. */
  attemptCount?: number | null;
}

export interface ExamConfig {
  /** Config schema version, for forward migrations. */
  schemaVersion: number;
  /** Matches `exams.slug`. */
  examSlug: string;
  examName: string;
  tier: string | null;
  /** Exam-wide countdown in minutes (SSC Tier 1 = one shared 60-min timer). */
  totalDurationMinutes: number;
  /** true when any section carries its own time lock (SSC Tier 1 = false). */
  hasSectionTimeLocks: boolean;
  defaultLanguage: string;
  negativeMarking: boolean;
  /** Exam-wide fallback marking, used when a section omits its own. */
  marksCorrect: number;
  marksWrong: number;
  sections: SectionConfig[];
}

/** Canonical SSC CGL Tier 1 config — the only fully-functional exam for now. */
export const SSC_CGL_TIER1_CONFIG: ExamConfig = {
  schemaVersion: 1,
  examSlug: "ssc-cgl-tier-1",
  examName: "SSC CGL Tier 1",
  tier: "Tier I",
  totalDurationMinutes: 60,
  hasSectionTimeLocks: false,
  defaultLanguage: "en",
  negativeMarking: true,
  marksCorrect: 2,
  marksWrong: -0.5,
  sections: [
    {
      key: "reasoning",
      name: "General Intelligence & Reasoning",
      order: 1,
      questionCount: 25,
      marksCorrect: 2,
      marksWrong: -0.5,
      questionType: "single_correct_mcq",
      timeLimitMinutes: null,
    },
    {
      key: "general_awareness",
      name: "General Awareness",
      order: 2,
      questionCount: 25,
      marksCorrect: 2,
      marksWrong: -0.5,
      questionType: "single_correct_mcq",
      timeLimitMinutes: null,
    },
    {
      key: "quantitative_aptitude",
      name: "Quantitative Aptitude",
      order: 3,
      questionCount: 25,
      marksCorrect: 2,
      marksWrong: -0.5,
      questionType: "single_correct_mcq",
      timeLimitMinutes: null,
    },
    {
      key: "english_comprehension",
      name: "English Comprehension",
      order: 4,
      questionCount: 25,
      marksCorrect: 2,
      marksWrong: -0.5,
      questionType: "single_correct_mcq",
      timeLimitMinutes: null,
    },
  ],
};

/** Fixed demo user until auth lands (§0). // TODO: replace with auth.uid(). */
export const DEMO_USER_ID = "00000000-0000-0000-0000-000000000001";

/* ------------------------------------------------------------------ *
 * Pure config readers — the ONLY sanctioned way for engine/scorer/mentor
 * to obtain marking numbers. Never hardcode +2 / −0.5 in those modules.
 * ------------------------------------------------------------------ */

/** Look up a section config by its DB slug. */
export function getSection(
  config: ExamConfig,
  sectionKey: string
): SectionConfig | undefined {
  return config.sections.find((s) => s.key === sectionKey);
}

/**
 * Marking for a section, falling back to exam-wide values when the section
 * (or the section lookup) doesn't specify. Returns SIGNED wrong marks.
 */
export function getSectionMarking(
  config: ExamConfig,
  sectionKey: string
): { correct: number; wrong: number } {
  const section = getSection(config, sectionKey);
  return {
    correct: section?.marksCorrect ?? config.marksCorrect,
    wrong: section?.marksWrong ?? config.marksWrong,
  };
}

/** Total question count implied by the section configuration. */
export function getTotalQuestions(config: ExamConfig): number {
  return config.sections.reduce((n, s) => n + s.questionCount, 0);
}

/** Maximum achievable raw score (every question correct). */
export function getMaxScore(config: ExamConfig): number {
  return config.sections.reduce(
    (m, s) => m + s.questionCount * s.marksCorrect,
    0
  );
}

/**
 * Break-even guessing accuracy for a section: the accuracy at which the
 * expected value of a blind attempt is zero. For +2 / −0.5 → 0.5 / 2.5 = 20%.
 * Below this, guessing on that section costs marks on average (powers §6a).
 */
export function getBreakEvenAccuracy(
  config: ExamConfig,
  sectionKey: string
): number {
  const { correct, wrong } = getSectionMarking(config, sectionKey);
  const penalty = Math.abs(wrong);
  const denom = correct + penalty;
  return denom > 0 ? penalty / denom : 0;
}

/** Sections in their fixed exam order. */
export function orderedSections(config: ExamConfig): SectionConfig[] {
  return [...config.sections].sort((a, b) => a.order - b.order);
}
