import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getSectionMarking,
  getMaxScore,
  getBreakEvenAccuracy,
  getTotalQuestions,
  type ExamConfig,
} from "./exam-config";
import { SSC_CGL_TIER1_CONFIG } from "./exam-config";

/**
 * Guardrail: the marks model must be config-driven, never a hardcoded scalar or a
 * hardcoded 20% break-even. These tests use configs whose ratios do NOT evaluate
 * to 20%, and a section where marks != question count, which is exactly what
 * breaks a naive `marks == questionCount` assumption.
 */

// SBI-style Mains config fragment: Reasoning is 60 marks for 50 questions (1.2/Q).
const SBI_MAINS_LIKE: ExamConfig = {
  schemaVersion: 1,
  examSlug: "sbi-clerk-mains",
  examName: "SBI Clerk Mains",
  tier: null,
  totalDurationMinutes: 160,
  hasSectionTimeLocks: true,
  defaultLanguage: "en",
  negativeMarking: true,
  marksCorrect: 1,
  marksWrong: -0.25,
  sections: [
    { key: "english", name: "General English", order: 1, questionCount: 40, marksCorrect: 1, marksWrong: -0.25, questionType: "single_correct_mcq", timeLimitMinutes: 35 },
    { key: "quantitative_aptitude", name: "Quantitative Aptitude", order: 2, questionCount: 50, marksCorrect: 1, marksWrong: -0.25, questionType: "single_correct_mcq", timeLimitMinutes: 45 },
    // The trap: 50 questions but 60 marks → 1.2 marks per question.
    { key: "reasoning", name: "Reasoning + Computer Aptitude", order: 3, questionCount: 50, marksCorrect: 1.2, marksWrong: -0.3, questionType: "single_correct_mcq", timeLimitMinutes: 45 },
    { key: "general_awareness", name: "General/Financial Awareness", order: 4, questionCount: 50, marksCorrect: 1, marksWrong: -0.25, questionType: "single_correct_mcq", timeLimitMinutes: 35 },
  ],
};

test("SSC: per-section marking is +2 / −0.5 and max score is 200", () => {
  const m = getSectionMarking(SSC_CGL_TIER1_CONFIG, "quantitative_aptitude");
  assert.equal(m.correct, 2);
  assert.equal(m.wrong, -0.5);
  assert.equal(getTotalQuestions(SSC_CGL_TIER1_CONFIG), 100);
  assert.equal(getMaxScore(SSC_CGL_TIER1_CONFIG), 200);
});

test("SSC break-even is computed (0.5 / 2.5 = 20%), not assumed", () => {
  assert.ok(Math.abs(getBreakEvenAccuracy(SSC_CGL_TIER1_CONFIG, "reasoning") - 0.2) < 1e-9);
});

test("marks != question count: a 1.2-marks section is respected in the max score", () => {
  // 40*1 + 50*1 + 50*1.2 + 50*1 = 40 + 50 + 60 + 50 = 200 marks over 190 questions.
  assert.equal(getTotalQuestions(SBI_MAINS_LIKE), 190);
  assert.equal(getMaxScore(SBI_MAINS_LIKE), 200);
  // The naive assumption (marks == questions) would give 190 — guard against it.
  assert.notEqual(getMaxScore(SBI_MAINS_LIKE), getTotalQuestions(SBI_MAINS_LIKE));
});

test("break-even is NOT a hardcoded 20% when the ratio differs", () => {
  // Reasoning: +1.2 / −0.3 → 0.3 / 1.5 = 20% (coincidentally still 20%).
  assert.ok(Math.abs(getBreakEvenAccuracy(SBI_MAINS_LIKE, "reasoning") - 0.2) < 1e-9);
  // A deliberately different ratio +2 / −0.25 → 0.25 / 2.25 = 11.11% proves the
  // threshold is computed, which a hardcoded 20% would fail.
  const skew: ExamConfig = {
    ...SBI_MAINS_LIKE,
    sections: [{ ...SBI_MAINS_LIKE.sections[0], key: "english", marksCorrect: 2, marksWrong: -0.25 }],
  };
  const be = getBreakEvenAccuracy(skew, "english");
  assert.ok(Math.abs(be - 0.25 / 2.25) < 1e-9, `expected ~0.111, got ${be}`);
  assert.notEqual(Math.round(be * 100) / 100, 0.2);
});
