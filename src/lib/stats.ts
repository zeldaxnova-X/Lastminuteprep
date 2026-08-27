import { unstable_cache } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase-server";

/** Fallback shown only if the DB is briefly unreachable at render time. */
const QUESTION_COUNT_FALLBACK = 5300;

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
      const { count, error } = await supabase
        .from("questions")
        .select("id", { count: "exact", head: true });
      if (error || !count) return QUESTION_COUNT_FALLBACK;
      return count;
    } catch {
      return QUESTION_COUNT_FALLBACK;
    }
  },
  ["question-count"],
  { revalidate: 30 }
);
