/**
 * Per-attempt AI-Mentor narration (§6b), now powered by DeepSeek (the single
 * MarksenseAI provider). Kept at this path + export name so the report route is
 * unchanged. The API key is server-only; never exposed to the client.
 *
 * Graceful degradation: with no DEEPSEEK_API_KEY (or on API error) it returns
 * null and the caller renders the deterministic report without the narrative.
 */
import type { MentorAnalysis } from "./mentor-analysis";
import { MENTOR_SYSTEM_PROMPT, buildMentorUserMessage } from "./mentor-prompt";
import { deepseekChat, sanitizeProse } from "@/lib/ai/deepseek";

export interface NarrationResult {
  narrative: string | null;
  /** Why narration is absent, for observability. undefined on success. */
  degradedReason?: "no_api_key" | "api_error" | "empty" | "bad_json";
}

/** Generate the coaching markdown from a single-attempt deterministic analysis. */
export async function narrateMentorReport(
  analysis: MentorAnalysis
): Promise<NarrationResult> {
  const { text, degradedReason } = await deepseekChat({
    system: MENTOR_SYSTEM_PROMPT,
    user: buildMentorUserMessage(analysis),
    maxTokens: 2000,
    temperature: 0.4,
  });
  return { narrative: text ? sanitizeProse(text) : text, degradedReason };
}
