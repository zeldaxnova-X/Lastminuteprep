/**
 * Blueprint conformance — pure checks that a generated paper matches an exam's
 * config exactly (section counts, total questions, total marks). Used by the
 * guardrail test "each exam's generated paper matches its blueprint" and by the
 * paper generator to assert before returning a paper.
 */
import {
  getMaxScore,
  getSectionMarking,
  getTotalQuestions,
  orderedSections,
  type ExamConfig,
} from "./exam-config";

export interface PaperQuestion {
  /** DB section slug (must match a config section key). */
  section: string;
}

export interface ConformanceResult {
  ok: boolean;
  errors: string[];
  totalQuestions: number;
  totalMarks: number;
  perSection: Record<string, number>;
}

/** Max marks of a generated paper = sum of each question's section correct-mark. */
export function paperMaxMarks(questions: PaperQuestion[], config: ExamConfig): number {
  let m = 0;
  for (const q of questions) m += getSectionMarking(config, q.section).correct;
  return Math.round(m * 100) / 100;
}

/**
 * Check a generated paper against the exam blueprint. Every section must have
 * EXACTLY its configured question count, the totals must match, and no question
 * may belong to a section the blueprint doesn't declare.
 */
export function checkPaperConformance(
  questions: PaperQuestion[],
  config: ExamConfig
): ConformanceResult {
  const errors: string[] = [];
  const perSection: Record<string, number> = {};
  for (const q of questions) perSection[q.section] = (perSection[q.section] ?? 0) + 1;

  // Every question's section must be declared in the blueprint.
  const declared = new Set(config.sections.map((s) => s.key));
  for (const key of Object.keys(perSection)) {
    if (!declared.has(key)) {
      errors.push(`section "${key}" is not in the ${config.examSlug} blueprint`);
    }
  }

  // Each declared section must have exactly its configured count.
  for (const s of orderedSections(config)) {
    const got = perSection[s.key] ?? 0;
    if (got !== s.questionCount) {
      errors.push(`section "${s.key}": expected ${s.questionCount} questions, got ${got}`);
    }
  }

  const totalQuestions = questions.length;
  const expectedTotal = getTotalQuestions(config);
  if (totalQuestions !== expectedTotal) {
    errors.push(`total questions: expected ${expectedTotal}, got ${totalQuestions}`);
  }

  const totalMarks = paperMaxMarks(questions, config);
  const expectedMarks = getMaxScore(config);
  if (totalMarks !== expectedMarks) {
    errors.push(`total marks: expected ${expectedMarks}, got ${totalMarks}`);
  }

  return { ok: errors.length === 0, errors, totalQuestions, totalMarks, perSection };
}
