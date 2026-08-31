/**
 * Unit tests for the deterministic scorer (§5). Run: `npm test`.
 * Uses node:test + node:assert via tsx, no extra test dependency.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreSession, type ResponseInput, type ScoreableSession } from "./score-session";
import { SSC_CGL_TIER1_CONFIG, type ExamConfig } from "./exam-config";

const cfg = SSC_CGL_TIER1_CONFIG;

/** Build a response with sensible defaults. */
function r(p: Partial<ResponseInput> & Pick<ResponseInput, "status">): ResponseInput {
  return {
    questionId: p.questionId ?? Math.random().toString(36).slice(2),
    section: p.section ?? "reasoning",
    selectedOption: p.selectedOption ?? null,
    correctOption: p.correctOption ?? "A",
    status: p.status,
    confidence: p.confidence,
    timeSpentMs: p.timeSpentMs,
  };
}

function session(responses: ResponseInput[]): ScoreableSession {
  return { responses };
}

test("all correct → raw = net = maxScore, accuracy 1", () => {
  const s = session([
    r({ status: "answered", selectedOption: "A", correctOption: "A" }),
    r({ status: "answered", selectedOption: "B", correctOption: "B" }),
    r({ status: "answered_marked", selectedOption: "C", correctOption: "C" }),
  ]);
  const res = scoreSession(s, cfg);
  assert.equal(res.totalCorrect, 3);
  assert.equal(res.totalWrong, 0);
  assert.equal(res.totalSkipped, 0);
  assert.equal(res.rawScore, 6); // 3 × +2
  assert.equal(res.netScore, 6);
  assert.equal(res.maxScore, 6);
  assert.equal(res.accuracy, 1);
});

test("+2 / −0.5 marking applied; skipped never penalised", () => {
  // 2 correct, 3 wrong, 2 skipped
  const s = session([
    r({ status: "answered", selectedOption: "A", correctOption: "A" }),
    r({ status: "answered", selectedOption: "A", correctOption: "A" }),
    r({ status: "answered", selectedOption: "B", correctOption: "A" }),
    r({ status: "answered", selectedOption: "C", correctOption: "A" }),
    r({ status: "answered", selectedOption: "D", correctOption: "A" }),
    r({ status: "not_answered", selectedOption: null }),
    r({ status: "not_visited", selectedOption: null }),
  ]);
  const res = scoreSession(s, cfg);
  assert.equal(res.totalCorrect, 2);
  assert.equal(res.totalWrong, 3);
  assert.equal(res.totalSkipped, 2);
  assert.equal(res.attempted, 5);
  assert.equal(res.rawScore, 4); // 2 × +2
  assert.equal(res.netScore, 2.5); // 4 − (3 × 0.5)
  assert.equal(res.accuracy, 2 / 5);
});

test("Answered & Marked for Review IS evaluated", () => {
  const s = session([
    r({ status: "answered_marked", selectedOption: "A", correctOption: "A" }), // correct
    r({ status: "answered_marked", selectedOption: "B", correctOption: "A" }), // wrong
  ]);
  const res = scoreSession(s, cfg);
  assert.equal(res.attempted, 2);
  assert.equal(res.totalCorrect, 1);
  assert.equal(res.totalWrong, 1);
  assert.equal(res.netScore, 1.5); // +2 − 0.5
});

test("Marked for Review WITHOUT a saved answer is NOT evaluated", () => {
  const s = session([
    r({ status: "marked", selectedOption: null, correctOption: "A" }),
  ]);
  const res = scoreSession(s, cfg);
  assert.equal(res.attempted, 0);
  assert.equal(res.totalSkipped, 1);
  assert.equal(res.netScore, 0);
  assert.equal(res.rawScore, 0);
});

test("a stray selectedOption without a saved status is NOT evaluated", () => {
  // Defends the 'select/jump does not save' quirk at the scoring layer.
  const s = session([
    r({ status: "not_answered", selectedOption: "A", correctOption: "A" }),
  ]);
  const res = scoreSession(s, cfg);
  assert.equal(res.attempted, 0);
  assert.equal(res.totalSkipped, 1);
  assert.equal(res.netScore, 0);
});

test("all un-attempted → zero score, zero penalty, accuracy 0", () => {
  const s = session([
    r({ status: "not_visited", selectedOption: null }),
    r({ status: "not_answered", selectedOption: null }),
    r({ status: "marked", selectedOption: null }),
  ]);
  const res = scoreSession(s, cfg);
  assert.equal(res.netScore, 0);
  assert.equal(res.rawScore, 0);
  assert.equal(res.attempted, 0);
  assert.equal(res.accuracy, 0); // no divide-by-zero
});

test("section breakdown: counts, net, accuracy, avg time", () => {
  const s = session([
    r({ section: "reasoning", status: "answered", selectedOption: "A", correctOption: "A", timeSpentMs: 1000 }),
    r({ section: "reasoning", status: "answered", selectedOption: "B", correctOption: "A", timeSpentMs: 3000 }),
    r({ section: "quantitative_aptitude", status: "answered", selectedOption: "C", correctOption: "C", timeSpentMs: 5000 }),
    r({ section: "quantitative_aptitude", status: "not_answered", selectedOption: null, timeSpentMs: 1000 }),
  ]);
  const res = scoreSession(s, cfg);
  const reasoning = res.sectionBreakdown.find((x) => x.key === "reasoning")!;
  const quant = res.sectionBreakdown.find((x) => x.key === "quantitative_aptitude")!;

  assert.equal(reasoning.correct, 1);
  assert.equal(reasoning.wrong, 1);
  assert.equal(reasoning.netScore, 1.5); // +2 − 0.5
  assert.equal(reasoning.accuracy, 0.5);
  assert.equal(reasoning.avgTimeMs, 2000); // (1000+3000)/2

  assert.equal(quant.correct, 1);
  assert.equal(quant.skipped, 1);
  assert.equal(quant.netScore, 2);
  assert.equal(quant.accuracy, 1); // 1 correct / 1 attempted
  assert.equal(quant.avgTimeMs, 3000); // (5000+1000)/2 over both questions
});

test("section breakdown is emitted in config order", () => {
  const s = session([
    r({ section: "english_comprehension", status: "answered", selectedOption: "A", correctOption: "A" }),
    r({ section: "reasoning", status: "answered", selectedOption: "A", correctOption: "A" }),
    r({ section: "general_awareness", status: "answered", selectedOption: "A", correctOption: "A" }),
  ]);
  const res = scoreSession(s, cfg);
  assert.deepEqual(
    res.sectionBreakdown.map((x) => x.key),
    ["reasoning", "general_awareness", "english_comprehension"]
  );
});

test("config-driven: a NEET-style +4/−1 config changes the score with zero code changes", () => {
  const neet: ExamConfig = {
    ...cfg,
    marksCorrect: 4,
    marksWrong: -1,
    sections: cfg.sections.map((sec) => ({ ...sec, marksCorrect: 4, marksWrong: -1 })),
  };
  const s = session([
    r({ status: "answered", selectedOption: "A", correctOption: "A" }), // correct
    r({ status: "answered", selectedOption: "B", correctOption: "A" }), // wrong
  ]);
  const ssc = scoreSession(s, cfg);
  const res = scoreSession(s, neet);
  assert.equal(ssc.netScore, 1.5); // +2 − 0.5
  assert.equal(res.rawScore, 4); // +4
  assert.equal(res.netScore, 3); // +4 − 1
  assert.equal(res.maxScore, 8); // 2 × +4
});

test("per-section marking override is respected", () => {
  // English with no negative marking; reasoning keeps −0.5.
  const mixed: ExamConfig = {
    ...cfg,
    sections: cfg.sections.map((sec) =>
      sec.key === "english_comprehension" ? { ...sec, marksWrong: 0 } : sec
    ),
  };
  const s = session([
    r({ section: "english_comprehension", status: "answered", selectedOption: "B", correctOption: "A" }), // wrong, no penalty
    r({ section: "reasoning", status: "answered", selectedOption: "B", correctOption: "A" }), // wrong, −0.5
  ]);
  const res = scoreSession(s, mixed);
  assert.equal(res.netScore, -0.5);
});

test("a full 100-question SSC session scores like the real exam", () => {
  const responses: ResponseInput[] = [];
  for (const sec of cfg.sections) {
    for (let i = 0; i < sec.questionCount; i++) {
      // 15 correct, 6 wrong, 4 skipped per 25-question section.
      let status: ResponseInput["status"] = "answered";
      let selected: "A" | "B" = "A";
      if (i < 15) selected = "A"; // correct
      else if (i < 21) selected = "B"; // wrong
      else status = "not_answered"; // skipped
      responses.push(
        r({ section: sec.key, status, selectedOption: status === "answered" ? selected : null, correctOption: "A" })
      );
    }
  }
  const res = scoreSession(session(responses), cfg);
  assert.equal(res.total, 100);
  assert.equal(res.totalCorrect, 60);
  assert.equal(res.totalWrong, 24);
  assert.equal(res.totalSkipped, 16);
  assert.equal(res.rawScore, 120); // 60 × +2
  assert.equal(res.netScore, 108); // 120 − (24 × 0.5)
  assert.equal(res.maxScore, 200);
});
