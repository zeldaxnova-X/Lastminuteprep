/**
 * The MarksenseAI action plan: a deterministic, per-user task list derived from
 * the learner signals. Each task is one concrete thing to do next to gain marks,
 * and where it makes sense it deep-links a real test pulled from the question
 * bank (a topic test for a weak topic, a section drill, a full mock). Pure and
 * signal-driven, so it is dynamic per user and needs no AI to work.
 */
import type { LearnerSignals, TopicSignal } from "./learner-signals";

export type TaskKind = "topic" | "section" | "strategy" | "mock";
export type TaskPriority = "high" | "medium" | "low";

export interface ActionTask {
  id: string;
  kind: TaskKind;
  priority: TaskPriority;
  title: string;
  detail: string;
  metric?: string; // compact evidence, e.g. "42% · seen in 3 mocks"
  cta?: { label: string; href: string };
}

/** section slug -> the canonical Subject display name the test flow expects. */
const SECTION_TO_SUBJECT: Record<string, string> = {
  quantitative_aptitude: "Quantitative Aptitude",
  reasoning: "General Intelligence & Reasoning",
  general_awareness: "General Awareness",
  english_comprehension: "English Comprehension",
};

/** Build a topic-test deep link straight to the CBT instructions screen. */
function topicTestHref(topic: string, sectionSlug?: string, count = 15): string | null {
  const subject = sectionSlug ? SECTION_TO_SUBJECT[sectionSlug] : undefined;
  if (!subject) return null;
  const p = new URLSearchParams({
    exam_type: "subject_test",
    subject,
    topic,
    questions: String(count),
    time: String(Math.max(5, Math.round(count * 0.6))),
    title: `${topic}, Topic Test`,
  });
  return `/test/instructions?${p.toString()}`;
}

function subjectTestHref(sectionSlug: string, count = 25): string | null {
  const subject = SECTION_TO_SUBJECT[sectionSlug];
  if (!subject) return null;
  const p = new URLSearchParams({
    exam_type: "subject_test",
    subject,
    questions: String(count),
    time: String(Math.round(count * 0.6)),
    title: `${subject}, Section Drill`,
  });
  return `/test/instructions?${p.toString()}`;
}

const topicMetric = (t: TopicSignal) =>
  `${t.accuracyPct}% · ${t.attempted} Qs across ${t.appearedInAttempts} mock${t.appearedInAttempts === 1 ? "" : "s"}`;

/**
 * Produce an ordered action plan. Most-costly, most-actionable tasks first:
 * weak topics (with a ready topic test), then strategy fixes (calibration,
 * pacing), a weakest-section drill if topics are thin, and always a full mock
 * to keep the trend honest.
 */
export function buildActionPlan(signals: LearnerSignals): ActionTask[] {
  const tasks: ActionTask[] = [];

  // 1) Weak topics, each with a ready-to-start topic test from the bank.
  for (const t of signals.topicWeakpoints.slice(0, 4)) {
    const href = topicTestHref(t.topic, t.section);
    tasks.push({
      id: `topic:${t.topic}`,
      kind: "topic",
      priority: t.accuracyPct < 45 ? "high" : "medium",
      title: `Fix ${t.topic}`,
      detail: `You're at ${t.accuracyPct}% here. A short, focused, timed set is the fastest way to lift a weak topic.`,
      metric: topicMetric(t),
      cta: href ? { label: `Start ${t.topic} test`, href } : undefined,
    });
  }

  // 2) Calibration: guessing where you were sure but wrong costs double.
  if (signals.tendencies.calibration === "overconfident" && signals.tendencies.avgMarksLostToBadGuessing > 0) {
    tasks.push({
      id: "strategy:calibration",
      kind: "strategy",
      priority: "high",
      title: "Stop the confident-but-wrong guesses",
      detail:
        "You lose marks on questions you felt sure about. Before you commit an answer you're not certain of, skip it, under negative marking a wrong guess costs you twice.",
      metric: `~${signals.tendencies.avgMarksLostToBadGuessing} marks/mock lost to bad guesses`,
    });
  }

  // 3) Pacing.
  if (signals.tendencies.pacing === "over-spending") {
    tasks.push({
      id: "strategy:pacing-slow",
      kind: "strategy",
      priority: "medium",
      title: "Cap time per question",
      detail:
        "You sink too long into a few questions and run short elsewhere. Set a hard 60-second cap; if you're not close, mark and move on.",
    });
  } else if (signals.tendencies.pacing === "rushing") {
    tasks.push({
      id: "strategy:pacing-fast",
      kind: "strategy",
      priority: "medium",
      title: "Slow down on the ones you can get",
      detail:
        "You're rushing into avoidable errors. Give solvable questions a few extra seconds to check before you lock the answer.",
    });
  }

  // 4) If we don't have enough topic detail yet, drill the weakest section.
  if (signals.topicWeakpoints.length < 2 && signals.sections.length > 0) {
    const weakest = [...signals.sections].sort((a, b) => a.accuracyPct - b.accuracyPct)[0];
    const slug = SUBJECT_TO_SECTION[weakest.name] ?? weakest.name;
    const href = subjectTestHref(slug);
    if (weakest.accuracyPct < 70) {
      tasks.push({
        id: `section:${weakest.name}`,
        kind: "section",
        priority: "medium",
        title: `Drill ${weakest.name}`,
        detail: `Your weakest section at ${weakest.accuracyPct}%. A 25-question section drill builds the base before topic-level work.`,
        metric: `${weakest.accuracyPct}% overall`,
        cta: href ? { label: `Start ${weakest.name} drill`, href } : undefined,
      });
    }
  }

  // 5) Always: a full mock to keep the trend measured.
  tasks.push({
    id: "mock:full",
    kind: "mock",
    priority: "low",
    title: "Take a full 100-question mock",
    detail:
      "Consolidate the above and keep your score trend honest. One full mock a week is the rhythm that moves the number.",
    cta: { label: "Start a full mock", href: "/test/create?mode=random_test" },
  });

  const order: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 };
  return tasks.sort((a, b) => order[a.priority] - order[b.priority]);
}

/** Reverse map for section drills (Subject display name -> slug). */
const SUBJECT_TO_SECTION: Record<string, string> = Object.fromEntries(
  Object.entries(SECTION_TO_SUBJECT).map(([slug, name]) => [name, slug])
);
