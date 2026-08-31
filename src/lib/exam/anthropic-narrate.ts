/**
 * Server-side Anthropic narration (§6b) via raw fetch, no SDK dependency.
 * The API key is read from the environment and NEVER exposed to the client.
 * Graceful degradation: if no key is set (or the call fails), returns null and
 * the caller renders the deterministic report without the narrative.
 *
 * Model: claude-sonnet-4-6 (per spec §2).
 */
import type { MentorAnalysis } from "./mentor-analysis";
import {
  MENTOR_SYSTEM_PROMPT,
  buildMentorUserMessage,
} from "./mentor-prompt";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-6";

export interface NarrationResult {
  narrative: string | null;
  /** Why narration is absent, for observability. undefined on success. */
  degradedReason?: "no_api_key" | "api_error";
}

/** Generate the coaching markdown from a deterministic analysis. */
export async function narrateMentorReport(
  analysis: MentorAnalysis
): Promise<NarrationResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { narrative: null, degradedReason: "no_api_key" };

  try {
    const res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2000,
        system: MENTOR_SYSTEM_PROMPT,
        messages: [
          { role: "user", content: buildMentorUserMessage(analysis) },
        ],
      }),
    });

    if (!res.ok) {
      console.error("Anthropic narration failed:", res.status, await res.text());
      return { narrative: null, degradedReason: "api_error" };
    }

    const data = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const text = (data.content ?? [])
      .filter((b) => b.type === "text" && b.text)
      .map((b) => b.text)
      .join("\n")
      .trim();

    return text
      ? { narrative: text }
      : { narrative: null, degradedReason: "api_error" };
  } catch (err) {
    console.error("Anthropic narration error:", err);
    return { narrative: null, degradedReason: "api_error" };
  }
}
