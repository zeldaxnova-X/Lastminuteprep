import { unstable_cache } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { EXAM_REGISTRY } from "@/lib/exam/registry";
import { contentObjectName } from "@/lib/exam/content-repo";

/** Fallback shown only if the DB is briefly unreachable at render time. */
const QUESTION_COUNT_FALLBACK = 13000;

/**
 * Count questions in the bank across EVERY live exam (SSC + SBI + IBPS + …),
 * not just the default exam. Each exam's content is in its own schema, read
 * through its sanctioned public object (contentObjectName) so this stays within
 * the multi-exam isolation guardrail. Sums per-exam counts.
 */
export async function countBankQuestions(supabase: SupabaseClient): Promise<number> {
  let total = 0;
  for (const code of Object.keys(EXAM_REGISTRY)) {
    const { count, error } = await supabase
      .from(contentObjectName(code, "questions"))
      .select("id", { count: "exact", head: true });
    if (!error && count) total += count;
  }
  return total;
}

/**
 * Live count of questions in the bank, for server-rendered landing copy.
 * Cached for 30s (ISR) so the marketing page stays fast but the number tracks
 * the real dataset as it grows. The client also polls /api/stats/questions to
 * move the headline metric in an already-open tab.
 */
export const getQuestionCount = unstable_cache(
  async (): Promise<number> => {
    try {
      const supabase = createServerSupabaseClient();
      const total = await countBankQuestions(supabase);
      return total || QUESTION_COUNT_FALLBACK;
    } catch {
      return QUESTION_COUNT_FALLBACK;
    }
  },
  ["question-count"],
  { revalidate: 30 }
);
