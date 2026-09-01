/**
 * Unit tests for the longitudinal signal aggregator (MarksenseAI). Run: `npm test`.
 * Pure function, no DB or AI. Uses node:test + node:assert via tsx.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { aggregateSignals, signalsHash, type AttemptDatum } from "./learner-signals";
import type { MentorAnalysis } from "@/lib/exam/mentor-analysis";

/** Minimal MentorAnalysis stub with just the fields the aggregator reads. */
function analysis(opts: {
  net: number;
  accuracy: number;
  maxScore?: number;
  sections?: Array<{ name: string; correct: number; attempted: number; accuracy: number; netScore: number }>;
  topics?: Array<{ name: string; correct: number; attempted: number; accuracy: number; netScore: number }>;
  overconfident?: boolean;
  underconfident?: boolean;
  marksLostGuessing?: number;
  optimalGain?: number;
  timeSinks?: number;
  rushed?: number;
}): MentorAnalysis {
  const rank = <T,>(arr: T[]) => arr.map((x, i) => ({ ...x, key: String(i), rank: i + 1 }));
  return {
    schemaVersion: 1,
    score: {
      netScore: opts.net,
      accuracy: opts.accuracy,
      maxScore: opts.maxScore ?? 200,
    } as MentorAnalysis["score"],
    calibration: {
      overconfident: !!opts.overconfident,
      underconfident: !!opts.underconfident,
    } as MentorAnalysis["calibration"],
    skipStrategy: {
      marksLostShouldHaveSkipped: opts.marksLostGuessing ?? 0,
    } as MentorAnalysis["skipStrategy"],
    optimal: { gain: opts.optimalGain ?? 0 } as MentorAnalysis["optimal"],
    time: {
      timeSinks: Array.from({ length: opts.timeSinks ?? 0 }),
      rushedErrors: Array.from({ length: opts.rushed ?? 0 }),
    } as unknown as MentorAnalysis["time"],
    weakness: {
      sections: rank(opts.sections ?? []) as MentorAnalysis["weakness"]["sections"],
      topics: rank(opts.topics ?? []) as MentorAnalysis["weakness"]["topics"],
    },
  };
}

function datum(id: string, createdAt: string, a: MentorAnalysis): AttemptDatum {
  return { id, createdAt, analysis: a };
}

test("aggregates score trend and best/avg across attempts", () => {
  const s = aggregateSignals([
    datum("a", "2026-01-01", analysis({ net: 100, accuracy: 0.5 })),
    datum("b", "2026-01-02", analysis({ net: 110, accuracy: 0.55 })),
    datum("c", "2026-01-03", analysis({ net: 120, accuracy: 0.6 })),
  ]);
  assert.equal(s.attemptsAnalyzed, 3);
  assert.equal(s.score.firstNet, 100);
  assert.equal(s.score.latestNet, 120);
  assert.equal(s.score.bestNet, 120);
  assert.equal(s.score.avgNet, 110);
  assert.equal(s.score.trendPerAttempt, 10); // +10 marks per mock
  assert.equal(s.consistency.label, "improving");
});

test("ranks recurring weak topics with enough exposure, drops thin ones", () => {
  const weakTopic = { name: "Time & Work", correct: 1, attempted: 5, accuracy: 0.2, netScore: -1 };
  const strongTopic = { name: "Averages", correct: 5, attempted: 5, accuracy: 1, netScore: 10 };
  const thinTopic = { name: "Boats", correct: 0, attempted: 1, accuracy: 0, netScore: -0.5 };
  const s = aggregateSignals([
    datum("a", "2026-01-01", analysis({ net: 100, accuracy: 0.5, topics: [weakTopic, strongTopic, thinTopic] })),
    datum("b", "2026-01-02", analysis({ net: 100, accuracy: 0.5, topics: [weakTopic, strongTopic] })),
  ]);
  const weakNames = s.topicWeakpoints.map((t) => t.topic);
  assert.ok(weakNames.includes("Time & Work"));
  assert.ok(!weakNames.includes("Boats")); // <3 questions, filtered out
  assert.ok(!weakNames.includes("Averages")); // 100% accuracy is never a weakpoint
  assert.ok(s.topicStrengths.some((t) => t.topic === "Averages")); // it is a strength
  assert.equal(s.topicWeakpoints[0].topic, "Time & Work"); // weakest first
  const tw = s.topicWeakpoints.find((t) => t.topic === "Time & Work")!;
  assert.equal(tw.attempted, 10); // summed across both mocks
  assert.equal(tw.appearedInAttempts, 2);
});

test("flags overconfidence tendency when it recurs", () => {
  const s = aggregateSignals([
    datum("a", "2026-01-01", analysis({ net: 100, accuracy: 0.5, overconfident: true })),
    datum("b", "2026-01-02", analysis({ net: 100, accuracy: 0.5, overconfident: true })),
    datum("c", "2026-01-03", analysis({ net: 100, accuracy: 0.5 })),
  ]);
  assert.equal(s.tendencies.calibration, "overconfident");
  assert.equal(s.tendencies.overconfidentCount, 2);
});

test("hash changes when a new attempt lands", () => {
  const one = aggregateSignals([datum("a", "2026-01-01", analysis({ net: 100, accuracy: 0.5 }))]);
  const two = aggregateSignals([
    datum("a", "2026-01-01", analysis({ net: 100, accuracy: 0.5 })),
    datum("b", "2026-01-02", analysis({ net: 105, accuracy: 0.5 })),
  ]);
  assert.notEqual(signalsHash(one), signalsHash(two));
});

test("empty input is safe", () => {
  const s = aggregateSignals([]);
  assert.equal(s.attemptsAnalyzed, 0);
  assert.equal(s.tendencies.calibration, "unknown");
  assert.equal(s.score.avgNet, 0);
});
