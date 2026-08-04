import type { SupabaseClient } from "@supabase/supabase-js";
import type { QuestionContentBlock, QuestionOptionRich, ValidatedQuestion } from "@/types/database.types";

/**
 * Human-readable labels for the v2 canonical section slugs. The exam engine and
 * analytics group by the slug (validated_questions.subject); the UI renders the
 * label.
 */
export const SECTION_LABELS: Record<string, string> = {
  reasoning: "General Intelligence & Reasoning",
  general_awareness: "General Awareness",
  quantitative_aptitude: "Quantitative Aptitude",
  english_comprehension: "English Comprehension",
  statistics: "Statistics",
  general_studies: "General Studies",
  finance_economics: "Finance & Economics",
  unknown: "General",
};

export function sectionLabel(slug: string | null | undefined): string {
  if (!slug) return "General";
  return SECTION_LABELS[slug] ?? slug;
}

interface RichRow {
  id: string;
  stem: QuestionContentBlock[] | null;
  options: QuestionOptionRich[] | null;
  has_images: boolean | null;
  section: string | null;
  external_id: string | null;
  topic: string | null;
}

/**
 * Attach v2 rich content (stem/option blocks, image flags) to a list of
 * questions fetched from the `validated_questions` compatibility view.
 *
 * The rich fields live on the canonical `questions` table; this joins them in a
 * single query keyed by id. `correct_option` is intentionally NOT selected — the
 * client never receives the answer key while an exam is in progress.
 */
export async function enrichWithRichContent<T extends { id: string }>(
  supabase: SupabaseClient,
  questions: T[]
): Promise<(T & Partial<ValidatedQuestion>)[]> {
  if (!questions.length) return questions;
  const ids = questions.map((q) => q.id);

  const { data, error } = await supabase
    .from("questions")
    .select("id, stem, options, has_images, section, external_id, topic")
    .in("id", ids);

  if (error || !data) return questions;

  const byId = new Map<string, RichRow>(data.map((r: RichRow) => [r.id, r]));
  return questions.map((q) => {
    const r = byId.get(q.id);
    if (!r) return q;
    return {
      ...q,
      stem: r.stem ?? [],
      rich_options: r.options ?? [],
      has_images: r.has_images ?? false,
      external_id: r.external_id ?? null,
      section: r.section ?? undefined,
      topic: r.topic ?? null,
    };
  });
}

/**
 * Remove the answer key from questions before sending them to the client during
 * an in-progress attempt. Scoring is performed server-side on submit.
 */
export function stripAnswerKey<T extends { correct_answer?: unknown }>(questions: T[]): T[] {
  return questions.map((q) => ({ ...q, correct_answer: null })) as T[];
}
