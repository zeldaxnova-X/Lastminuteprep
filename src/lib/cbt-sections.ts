import type { SectionInput } from "@/lib/store/use-test-store";
import { getExamEntry } from "@/lib/exam/registry";

/**
 * Fixed SSC CGL Tier 1 section order (kept for back-compat / default).
 */
export const SSC_SECTION_ORDER: string[] = [
  "General Intelligence & Reasoning",
  "General Awareness",
  "Quantitative Aptitude",
  "English Comprehension",
];

/** Subject (display-name) order for an exam, from its config. Client-safe (the
 *  configs are pure constants). Falls back to SSC order. */
export function examSubjectOrder(examCode?: string | null): string[] {
  const cfg = getExamEntry(examCode).builtinConfig;
  return cfg.sections.slice().sort((a, b) => a.order - b.order).map((s) => s.name);
}

/** Per-section timer (minutes) for an exam, from its config (uniform per exam
 *  today: SSC 15, SBI 20). Falls back to 15. */
export function examSectionMinutes(examCode?: string | null): number {
  const cfg = getExamEntry(examCode).builtinConfig;
  const first = cfg.sections.find((s) => s.timeLimitMinutes != null);
  return first?.timeLimitMinutes ?? 15;
}

function orderIndexFor(order: string[]) {
  return (subject: string | null | undefined): number => {
    const i = order.indexOf(subject || "");
    return i === -1 ? order.length : i; // unknowns sort last, stable
  };
}

/**
 * Order questions into the exam's section sequence (stable within a section) and
 * group them into contiguous sections. Works for a single-subject drill (one
 * section) and a full multi-section mock alike. Pass `examCode` so a non-SSC exam
 * (e.g. SBI) orders by its own blueprint.
 */
export function sectionsFromQuestions<T extends { id: string; subject?: string | null }>(
  questions: T[],
  examCode?: string | null
): { ordered: T[]; sections: SectionInput[] } {
  const order = examSubjectOrder(examCode);
  const idx = orderIndexFor(order);
  const ordered = [...questions].sort((a, b) => idx(a.subject) - idx(b.subject));
  const sections: SectionInput[] = [];
  for (const q of ordered) {
    const name = q.subject || "General";
    const last = sections[sections.length - 1];
    if (last && last.name === name) last.questionIds.push(q.id);
    else sections.push({ name, questionIds: [q.id] });
  }
  return { ordered, sections };
}
