import { test } from "node:test";
import assert from "node:assert/strict";
import { checkPaperConformance, paperMaxMarks, type PaperQuestion } from "./blueprint";
import { SSC_CGL_TIER1_CONFIG, type ExamConfig } from "./exam-config";

/** Build a paper with the given per-section counts. */
function paper(counts: Record<string, number>): PaperQuestion[] {
  const qs: PaperQuestion[] = [];
  for (const [section, n] of Object.entries(counts)) {
    for (let i = 0; i < n; i++) qs.push({ section });
  }
  return qs;
}

const SSC_FULL = {
  reasoning: 25,
  general_awareness: 25,
  quantitative_aptitude: 25,
  english_comprehension: 25,
};

test("a correct SSC paper matches its blueprint exactly (100 Q / 200 marks)", () => {
  const r = checkPaperConformance(paper(SSC_FULL), SSC_CGL_TIER1_CONFIG);
  assert.equal(r.ok, true, r.errors.join("; "));
  assert.equal(r.totalQuestions, 100);
  assert.equal(r.totalMarks, 200);
});

test("a paper with a wrong section count fails conformance", () => {
  const bad = checkPaperConformance(paper({ ...SSC_FULL, reasoning: 24 }), SSC_CGL_TIER1_CONFIG);
  assert.equal(bad.ok, false);
  assert.ok(bad.errors.some((e) => e.includes("reasoning")));
  assert.ok(bad.errors.some((e) => e.includes("total questions")));
});

test("a paper containing a section not in the blueprint fails (cross-exam guard)", () => {
  // An SBI section slug leaking into an SSC paper must be rejected.
  const leaked = checkPaperConformance(
    paper({ reasoning: 25, general_awareness: 25, quantitative_aptitude: 25, english: 25 }),
    SSC_CGL_TIER1_CONFIG
  );
  assert.equal(leaked.ok, false);
  assert.ok(leaked.errors.some((e) => e.includes('"english"') && e.includes("blueprint")));
});

test("marks != question count: SBI-style blueprint conformance uses per-section marks", () => {
  const SBI_MAINS: ExamConfig = {
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
    optionsCount: 5,
    sections: [
      { key: "english", name: "General English", order: 1, questionCount: 40, marksCorrect: 1, marksWrong: -0.25, questionType: "single_correct_mcq", timeLimitMinutes: 35 },
      { key: "quantitative_aptitude", name: "Quantitative Aptitude", order: 2, questionCount: 50, marksCorrect: 1, marksWrong: -0.25, questionType: "single_correct_mcq", timeLimitMinutes: 45 },
      { key: "reasoning", name: "Reasoning + Computer Aptitude", order: 3, questionCount: 50, marksCorrect: 1.2, marksWrong: -0.3, questionType: "single_correct_mcq", timeLimitMinutes: 45 },
      { key: "general_awareness", name: "General/Financial Awareness", order: 4, questionCount: 50, marksCorrect: 1, marksWrong: -0.25, questionType: "single_correct_mcq", timeLimitMinutes: 35 },
    ],
  };
  const p = paper({ english: 40, quantitative_aptitude: 50, reasoning: 50, general_awareness: 50 });
  // 190 questions but 200 marks (Reasoning 50 × 1.2 = 60).
  assert.equal(paperMaxMarks(p, SBI_MAINS), 200);
  const r = checkPaperConformance(p, SBI_MAINS);
  assert.equal(r.ok, true, r.errors.join("; "));
  assert.equal(r.totalQuestions, 190);
  assert.equal(r.totalMarks, 200);
});
