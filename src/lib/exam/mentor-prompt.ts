/**
 * Prompt construction for the AI-Mentor narrative (§6b). Pure — builds the
 * system prompt and the compact JSON payload the LLM narrates. The LLM NEVER
 * computes numbers; it only turns the deterministic MentorAnalysis into warm,
 * specific coaching. Kept dependency-free so it is trivially testable.
 */
import type { MentorAnalysis } from "./mentor-analysis";
import type { SessionScore } from "./score-session";

export const MENTOR_SYSTEM_PROMPT = `You are an SSC CGL exam strategy coach.

Using ONLY the numbers provided in the JSON, write a specific, warm, and actionable report for the student. Rules:
- NEVER invent, estimate, or recompute any number. Every figure you cite must appear in the JSON.
- Address the student directly ("you"), like a supportive mentor — encouraging but honest.
- Prioritise the 2–3 highest-impact changes. Do not list everything.
- Marks are the currency: when you name a leak, cite the exact marks it cost.
- Be concise. No preamble, no "as an AI". Start straight at the report.

Output clean GitHub-flavoured Markdown with exactly these sections, in order, each as an H3 (###):
### Headline verdict
### What went well
### Your biggest score leak
### Skip-strategy coaching
### Pacing
### What to revise next

Keep each section to 1–3 short sentences or a tight bullet list. Total under ~350 words.`;

/**
 * Build a compact, numbers-only payload from the deterministic analysis.
 * Trims long per-question arrays to counts + a couple of examples so the model
 * gets the signal without the noise (and to keep tokens low).
 */
export function buildMentorPayload(analysis: MentorAnalysis) {
  const s: SessionScore = analysis.score;
  const cal = analysis.calibration;
  const skip = analysis.skipStrategy;
  const opt = analysis.optimal;
  const time = analysis.time;

  return {
    score: {
      raw: s.rawScore,
      net: s.netScore,
      max: s.maxScore,
      correct: s.totalCorrect,
      wrong: s.totalWrong,
      skipped: s.totalSkipped,
      attempted: s.attempted,
      accuracyPct: Math.round(s.accuracy * 1000) / 10,
    },
    confidenceCalibration: cal.buckets.map((b) => ({
      level: b.level,
      answered: b.count,
      correct: b.correct,
      accuracyPct: Math.round(b.accuracy * 1000) / 10,
      netMarks: b.netMarks,
    })),
    overconfident: cal.overconfident,
    underconfident: cal.underconfident,
    negativeMarking: {
      breakEvenAccuracyPct: Math.round(skip.breakEvenAccuracy * 1000) / 10,
      blindGuessExpectedValue: skip.blindGuessEV,
      guessAccuracyPct: Math.round(skip.guessed.accuracy * 1000) / 10,
      guessesMade: skip.guessed.count,
      guessingHelped: skip.guessingHelped,
      questionsYouShouldHaveSkipped: skip.shouldHaveSkipped.length,
      marksLostToPoorGuessing: skip.marksLostShouldHaveSkipped,
    },
    optimalScore: {
      youScored: opt.actualNet,
      achievableWithSmarterSkips: opt.achievableNet,
      extraMarks: opt.gain,
      skipTheseConfidenceLevels: opt.droppedBuckets,
    },
    pacing: {
      totalMinutesUsed: Math.round(time.totalTimeMs / 60000),
      budgetMinutes: Math.round(time.budgetMs / 60000),
      timeSinks: time.timeSinks.length,
      rushedConfidentErrors: time.rushedErrors.length,
      sections: time.sectionPacing.map((p) => ({
        section: p.name,
        minutesSpent: Math.round(p.actualMs / 60000),
        idealMinutes: Math.round(p.idealMs / 60000),
      })),
    },
    weakestSections: analysis.weakness.sections
      .filter((w) => w.attempted > 0)
      .slice(0, 3)
      .map((w) => ({
        section: w.name,
        accuracyPct: Math.round(w.accuracy * 1000) / 10,
        net: w.netScore,
      })),
  };
}

/** The user-turn content: a tight instruction + the numbers payload. */
export function buildMentorUserMessage(analysis: MentorAnalysis): string {
  const payload = buildMentorPayload(analysis);
  return `Here is the student's deterministic performance analysis for one SSC CGL Tier 1 mock (marking +2 correct / −0.5 wrong / 0 un-attempted). Write the coaching report.\n\n\`\`\`json\n${JSON.stringify(payload, null, 2)}\n\`\`\``;
}
