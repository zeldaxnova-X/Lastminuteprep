/**
 * DeepSeek is the single AI provider for MarksenseAI coaching. The API is
 * OpenAI-compatible (chat/completions), so this is a thin fetch wrapper, no SDK.
 *
 * The key is read from the environment (server-only) and NEVER exposed to the
 * client. Every call degrades gracefully: with no key set, or on any API error,
 * the helpers return `null` and the caller renders the deterministic output
 * without the AI layer. That keeps the paid experience honest even if the
 * provider is down.
 *
 * Env:
 *   DEEPSEEK_API_KEY   (required for any AI output; server-only)
 *   DEEPSEEK_MODEL     (optional, default "deepseek-chat")
 *   DEEPSEEK_BASE_URL  (optional, default "https://api.deepseek.com")
 */

const DEFAULT_BASE_URL = "https://api.deepseek.com";
const DEFAULT_MODEL = "deepseek-chat";

/** Whether an AI call can even be attempted (key present). */
export function aiEnabled(): boolean {
  return !!process.env.DEEPSEEK_API_KEY;
}

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

/**
 * Strip em/en dashes from model prose to honour the site-wide no-em-dash rule.
 * Numeric ranges (2020-2024) collapse to a hyphen; every other dash becomes a
 * comma clause, matching the house style. Apply to any user-visible AI text.
 */
export function sanitizeProse(text: string): string {
  return text
    .replace(/(\d)\s*[–—]\s*(\d)/g, "$1-$2") // numeric range -> hyphen
    .replace(/\s*[—–]\s*/g, ", "); // remaining dashes -> comma clause
}

export type DegradedReason = "no_api_key" | "api_error" | "empty" | "bad_json";

interface ChatOptions {
  system: string;
  user: string;
  /** Cap output tokens. Defaults to 2000. */
  maxTokens?: number;
  /** 0..2. Lower = more deterministic. Defaults to 0.4 (coaching, not creative). */
  temperature?: number;
  /** Ask DeepSeek to emit a strict JSON object. Prompt must also request JSON. */
  json?: boolean;
}

export interface ChatResult {
  text: string | null;
  degradedReason?: DegradedReason;
}

/**
 * One-shot chat completion. Returns the assistant text, or null + a reason.
 * `signal`-free by design: called from server routes with their own timeouts.
 */
export async function deepseekChat(opts: ChatOptions): Promise<ChatResult> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return { text: null, degradedReason: "no_api_key" };

  const baseUrl = (process.env.DEEPSEEK_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, "");
  const model = process.env.DEEPSEEK_MODEL || DEFAULT_MODEL;

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: opts.maxTokens ?? 2000,
        temperature: opts.temperature ?? 0.4,
        ...(opts.json ? { response_format: { type: "json_object" } } : {}),
        messages: [
          { role: "system", content: opts.system },
          { role: "user", content: opts.user },
        ] satisfies ChatMessage[],
      }),
    });

    if (!res.ok) {
      // Body may contain the key echoed back? DeepSeek does not; still, log
      // status + a trimmed body, never the request we sent.
      console.error("DeepSeek chat failed:", res.status, (await res.text()).slice(0, 500));
      return { text: null, degradedReason: "api_error" };
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = data.choices?.[0]?.message?.content?.trim() ?? "";
    return text ? { text } : { text: null, degradedReason: "empty" };
  } catch (err) {
    console.error("DeepSeek chat error:", err);
    return { text: null, degradedReason: "api_error" };
  }
}

/**
 * Multi-turn chat completion (for the study coach). Takes a full message array
 * (system + alternating user/assistant). Same graceful degradation.
 */
export async function deepseekConverse(
  messages: ChatMessage[],
  opts?: { maxTokens?: number; temperature?: number }
): Promise<ChatResult> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return { text: null, degradedReason: "no_api_key" };

  const baseUrl = (process.env.DEEPSEEK_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, "");
  const model = process.env.DEEPSEEK_MODEL || DEFAULT_MODEL;

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        model,
        max_tokens: opts?.maxTokens ?? 1200,
        temperature: opts?.temperature ?? 0.5,
        messages,
      }),
    });
    if (!res.ok) {
      console.error("DeepSeek converse failed:", res.status, (await res.text()).slice(0, 300));
      return { text: null, degradedReason: "api_error" };
    }
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const text = data.choices?.[0]?.message?.content?.trim() ?? "";
    return text ? { text } : { text: null, degradedReason: "empty" };
  } catch (err) {
    console.error("DeepSeek converse error:", err);
    return { text: null, degradedReason: "api_error" };
  }
}

/**
 * Chat completion that must return a JSON object of shape T. Uses DeepSeek's
 * json_object mode and validates the parse. Returns null on any failure so the
 * caller can fall back to the deterministic layer.
 */
export async function deepseekJSON<T>(
  opts: Omit<ChatOptions, "json">
): Promise<{ data: T | null; degradedReason?: DegradedReason }> {
  const { text, degradedReason } = await deepseekChat({ ...opts, json: true });
  if (!text) return { data: null, degradedReason };
  try {
    return { data: JSON.parse(text) as T };
  } catch {
    // Occasionally a model fences JSON despite json mode; salvage the object.
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return { data: JSON.parse(match[0]) as T };
      } catch {
        /* fall through */
      }
    }
    console.error("DeepSeek JSON parse failed:", text.slice(0, 300));
    return { data: null, degradedReason: "bad_json" };
  }
}
