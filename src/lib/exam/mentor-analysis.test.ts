/**
 * Unit tests for the deterministic Mentor analysis (§6a). Run: `npm test`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeSession } from "./mentor-analysis";
import { type ResponseInput, type ScoreableSession, type Confidence } from "./score-session";
import { SSC_CGL_TIER1_CONFIG } from "./exam-config";

const cfg = SSC_CGL_TIER1_CONFIG;

function r(p: Partial<ResponseInput> & Pick<ResponseInput, "status">): ResponseInput {
  return {
    questionId: p.questionId ?? Math.random().toString(36).slice(2),
    section: p.section ?? "reasoning",
    selectedOption: p.selectedOption ?? null,
    correctOption: p.correctOption ?? "A",
    status: p.status,
    confidence: p.confidence,
    timeSpentMs: p.timeSpentMs,
    topic: p.topic,
  };
}

/** N answered questions at a given confidence, `correct` of them right. */
function answered(n: number, correct: number, confidence: Confidence, section = "reasoning"): ResponseInput[] {
  const out: ResponseInput[] = [];
  for (let i = 0; i < n; i++) {
    const isCorrect = i < correct;
    out.push(
      r({
        section,
        status: "answered",
        confidence,
        selectedOption: isCorrect ? "A" : "B",
        correctOption: "A",
        timeSpentMs: 30_000,
      })
    );
  }
  return out;
}

const session = (responses: ResponseInput[]): ScoreableSession => ({ responses });

test("break-even and blind-guess EV come from the config (+2/−0.5 → 20%, +0.125)", () => {
  const a = analyzeSession(session(answered(4, 1, "guessed")), cfg);
  assert.equal(a.skipStrategy.breakEvenAccuracy, 0.2);
  assert.equal(a.skipStrategy.blindGuessEV, 0.125);
});

test("confidence calibration: per-level accuracy and counts", () => {
  const a = analyzeSession(
    session([
      ...answered(10, 9, "confident"), // 90%
      ...answered(10, 5, "unsure"), // 50%
      ...answered(10, 1, "guessed"), // 10%
    ]),
    cfg
  );
  const byLevel = Object.fromEntries(a.calibration.buckets.map((b) => [b.level, b]));
  assert.equal(byLevel.confident.count, 10);
  assert.equal(byLevel.confident.accuracy, 0.9);
  assert.equal(byLevel.unsure.accuracy, 0.5);
  assert.equal(byLevel.guessed.accuracy, 0.1);
});

test("overconfidence is flagged when Confident accuracy is low", () => {
  // Mixed session so overall accuracy differs from the Confident bucket.
  const a = analyzeSession(
    session([...answered(10, 3, "confident"), ...answered(10, 8, "unsure")]),
    cfg
  );
  assert.equal(a.calibration.overconfident, true); // 30% Confident < 60%
  assert.ok(a.calibration.confidenceGap < 0); // Confident (0.30) below overall (0.55)
});

test("underconfidence is flagged when low-confidence answers are accurate", () => {
  const a = analyzeSession(
    session([...answered(8, 7, "unsure"), ...answered(4, 4, "guessed")]),
    cfg
  );
  assert.equal(a.calibration.underconfident, true);
});

test("guessing below break-even is flagged as unhelpful", () => {
  const a = analyzeSession(session(answered(10, 1, "guessed")), cfg); // 10% < 20%
  assert.equal(a.skipStrategy.guessingHelped, false);
});

test("guessing above break-even counts as helpful", () => {
  const a = analyzeSession(session(answered(10, 4, "guessed")), cfg); // 40% > 20%
  assert.equal(a.skipStrategy.guessingHelped, true);
});

test("marks lost: wrong Guessed/Unsure answers, quantified as wrongLowConf × penalty", () => {
  // 3 wrong guessed, 2 wrong unsure, 1 wrong confident (not counted here)
  const a = analyzeSession(
    session([
      ...answered(3, 0, "guessed"), // 3 wrong
      ...answered(2, 0, "unsure"), // 2 wrong
      ...answered(1, 0, "confident"), // wrong but Confident, excluded
    ]),
    cfg
  );
  // 5 low-confidence wrongs × 0.5 penalty each
  assert.equal(a.skipStrategy.marksLostShouldHaveSkipped, 2.5);
  assert.equal(a.skipStrategy.shouldHaveSkipped.length, 5);
});

test("optimal score: dropping a −EV bucket recovers its net loss", () => {
  // Confident: 8/10 correct (kept). Guessed: 0/10 correct (dropped).
  const a = analyzeSession(
    session([...answered(10, 8, "confident"), ...answered(10, 0, "guessed")]),
    cfg
  );
  // actual net = confident(8×2 − 2×0.5=15) + guessed(0 − 10×0.5=−5) = 10
  assert.equal(a.score.netScore, 10);
  // optimal keeps confident only → 15
  assert.equal(a.optimal.achievableNet, 15);
  assert.equal(a.optimal.gain, 5);
  assert.deepEqual(a.optimal.keptBuckets, ["confident"]);
  assert.deepEqual(a.optimal.droppedBuckets, ["guessed"]);
});

test("optimal score equals actual when every bucket is +EV (nothing to skip)", () => {
  const a = analyzeSession(
    session([...answered(10, 8, "confident"), ...answered(10, 6, "unsure")]),
    cfg
  );
  assert.equal(a.optimal.gain, 0);
  assert.equal(a.optimal.droppedBuckets.length, 0);
});

test("rushed errors: wrong + Confident + very fast are flagged", () => {
  const a = analyzeSession(
    session([
      r({ status: "answered", confidence: "confident", selectedOption: "B", correctOption: "A", timeSpentMs: 5_000 }),
      r({ status: "answered", confidence: "confident", selectedOption: "B", correctOption: "A", timeSpentMs: 40_000 }),
    ]),
    cfg
  );
  assert.equal(a.time.rushedErrors.length, 1);
  assert.equal(a.time.rushedErrors[0].timeMs, 5_000);
});

test("time sinks: wrong answers over the time-sink threshold are flagged", () => {
  // Realistic spread: 20 normal-paced questions + one 200s wrong sink.
  const filler: ResponseInput[] = [];
  for (let i = 0; i < 20; i++) {
    filler.push(
      r({ status: "answered", confidence: "unsure", selectedOption: "A", correctOption: "A", timeSpentMs: 20_000 })
    );
  }
  const a = analyzeSession(
    session([
      ...filler,
      r({ status: "answered", confidence: "unsure", selectedOption: "B", correctOption: "A", timeSpentMs: 200_000 }),
    ]),
    cfg
  );
  assert.equal(a.time.timeSinks.length, 1);
  assert.equal(a.time.timeSinks[0].timeMs, 200_000);
});

test("section weakness is ranked weakest-first", () => {
  const a = analyzeSession(
    session([
      ...answered(10, 9, "unsure", "reasoning"), // 90%
      ...answered(10, 3, "unsure", "quantitative_aptitude"), // 30%
    ]),
    cfg
  );
  const withAttempts = a.weakness.sections.filter((s) => s.attempted > 0);
  assert.equal(withAttempts[0].key, "quantitative_aptitude"); // weakest first
  assert.equal(withAttempts[0].rank, 1);
});

test("topic weakness stays empty when no topic tags are present", () => {
  const a = analyzeSession(session(answered(5, 3, "unsure")), cfg);
  assert.equal(a.weakness.topics.length, 0);
});

test("pure & deterministic: same input → identical output", () => {
  const s = session([...answered(10, 8, "confident"), ...answered(10, 2, "guessed")]);
  assert.deepEqual(analyzeSession(s, cfg), analyzeSession(s, cfg));
});
