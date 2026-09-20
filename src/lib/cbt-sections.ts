import type { SectionInput } from "@/lib/store/use-test-store";

/**
 * Fixed SSC CGL Tier 1 section order for the 2026 sectional-timer pattern.
 * Reasoning, then General Awareness, then Quantitative Aptitude, then English.
 */
export const SSC_SECTION_ORDER: string[] = [
  "General Intelligence & Reasoning",
  "General Awareness",
  "Quantitative Aptitude",
  "English Comprehension",
];

function orderIndex(subject: string | null | undefined): number {
  const i = SSC_SECTION_ORDER.indexOf(subject || "");
  return i === -1 ? SSC_SECTION_ORDER.length : i; // unknowns sort last, stable
}

/**
 * Order questions into the fixed SSC section sequence (stable within a section)
 * and group them into contiguous sections. Works for a single-subject drill
 * (one section) and a full 4-section mock alike.
 */
export function sectionsFromQuestions<T extends { id: string; subject?: string | null }>(
  questions: T[]
): { ordered: T[]; sections: SectionInput[] } {
  const ordered = [...questions].sort((a, b) => orderIndex(a.subject) - orderIndex(b.subject));
  const sections: SectionInput[] = [];
  for (const q of ordered) {
    const name = q.subject || "General";
    const last = sections[sections.length - 1];
    if (last && last.name === name) last.questionIds.push(q.id);
    else sections.push({ name, questionIds: [q.id] });
  }
  return { ordered, sections };
}
