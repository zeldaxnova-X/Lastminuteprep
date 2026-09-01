/**
 * The AI layer of MarksenseAI's learner profile. Takes the deterministic
 * longitudinal `LearnerSignals` and asks DeepSeek to turn them into a STRUCTURED,
 * renderable profile: a persona, ranked weakpoints (each with cited evidence and
 * a concrete drill), strengths, trajectory, and an ordered focus plan.
 *
 * The model narrates the numbers, it never invents them. Output is validated to
 * a known shape; anything malformed degrades to null and the dashboard falls
 * back to the deterministic signals.
 */
import { deepseekJSON, sanitizeProse } from "./deepseek";
import type { LearnerSignals } from "./learner-signals";

/** The four canonical SSC CGL subjects a drill can target (or null). */
export type DrillSubject =
  | "General Intelligence & Reasoning"
  | "General Awareness"
  | "Quantitative Aptitude"
  | "English Comprehension"
  | null;

export interface Weakpoint {
  area: string; // a topic/section name from the signals, or a strategy label
  kind: "topic" | "section" | "strategy";
  severity: "critical" | "high" | "moderate";
  evidence: string; // must cite figures from the signals
  drill: string; // one concrete, doable action
  drillSubject: DrillSubject; // exact subject string, so the UI can deep-link a mock
}

export interface LearnerProfile {
  persona: string; // short label, e.g. "Fast but leaky"
  headline: string; // one-line honest verdict
  trajectory: string; // where this student is heading and why
  strengths: string[]; // 2-3, specific
  weakpoints: Weakpoint[]; // 3-5, ranked most-costly first
  focusPlan: string[]; // exactly 3 next actions, ordered
  projectedGain: number; // realistic extra marks reachable next, from the signals
}

const SUBJECTS: ReadonlyArray<Exclude<DrillSubject, null>> = [
  "General Intelligence & Reasoning",
  "General Awareness",
  "Quantitative Aptitude",
  "English Comprehension",
];

export const PROFILE_SYSTEM_PROMPT = `You are MarksenseAI, a longitudinal SSC CGL performance analyst. You are given a JSON of deterministic signals aggregated across ALL of one student's mock attempts. Build a durable learner profile.

Field meanings (read carefully, do not conflate):
- "attemptsAnalyzed" and "appearedInAttempts" count MOCKS (whole tests).
- a topic/section "attempted" counts QUESTIONS, not mocks. Say "X questions", never "X attempts".
- "*Pct" fields are percentages; "net"/"marks"/"gain" are marks.

Hard rules:
- Use ONLY the numbers in the JSON. Never invent, estimate, or recompute a figure. Every number you cite must appear in the signals.
- Diagnose the PATTERN across attempts, not a single mock. Distinguish chronic weakpoints (recurring across many attempts) from noise.
- Be specific and honest. A weakpoint's "evidence" must quote the exact accuracy/marks/recurrence from the signals.
- Each weakpoint's "drill" is ONE concrete action the student can start now (e.g. "20 questions of Time-Speed-Distance, timed at 45s each").
- Rank weakpoints by marks cost, most costly first. 3 to 5 of them.
- "focusPlan" is exactly 3 ordered next actions for the coming week.
- "projectedGain" is realistic extra net marks reachable next, grounded in avgOptimalGain and the score trend. Do not exaggerate.
- No preamble, no "as an AI". Warm but direct, second person ("you").

Output ONLY a JSON object with this exact shape:
{
  "persona": string,               // 2-4 word label
  "headline": string,              // one sentence
  "trajectory": string,            // 1-2 sentences
  "strengths": string[],           // 2-3 items
  "weakpoints": [                  // 3-5 items, most costly first
    {
      "area": string,              // a topic/section name from the signals, or a strategy name
      "kind": "topic" | "section" | "strategy",
      "severity": "critical" | "high" | "moderate",
      "evidence": string,          // cite exact figures from the signals
      "drill": string,             // one concrete action
      "drillSubject": string|null  // EXACTLY one of: "General Intelligence & Reasoning", "General Awareness", "Quantitative Aptitude", "English Comprehension", or null
    }
  ],
  "focusPlan": string[],           // exactly 3 ordered actions
  "projectedGain": number          // realistic extra net marks
}`;

export function buildProfileUserMessage(signals: LearnerSignals): string {
  return `Longitudinal signals across ${signals.attemptsAnalyzed} completed SSC CGL Tier 1 mocks (marking +2 correct / -0.5 wrong / 0 skipped). Build the learner profile as specified.\n\n\`\`\`json\n${JSON.stringify(signals, null, 2)}\n\`\`\``;
}

/** Coerce/validate the model output into a safe LearnerProfile, or null. */
function validate(raw: unknown): LearnerProfile | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const asStr = (v: unknown): string => (typeof v === "string" ? v : "");
  // User-visible prose: also strip em/en dashes to honour the house style.
  const prose = (v: unknown): string => (typeof v === "string" ? sanitizeProse(v) : "");
  const strArr = (v: unknown): string[] =>
    Array.isArray(v)
      ? v.filter((x): x is string => typeof x === "string").map(sanitizeProse)
      : [];

  const wpRaw = Array.isArray(o.weakpoints) ? o.weakpoints : [];
  const weakpoints: Weakpoint[] = wpRaw
    .map((w): Weakpoint | null => {
      if (!w || typeof w !== "object") return null;
      const r = w as Record<string, unknown>;
      const kind = r.kind === "section" || r.kind === "strategy" ? r.kind : "topic";
      const severity =
        r.severity === "critical" || r.severity === "moderate"
          ? r.severity
          : "high";
      const ds = asStr(r.drillSubject) as Exclude<DrillSubject, null>;
      const drillSubject: DrillSubject = SUBJECTS.includes(ds) ? ds : null;
      const area = prose(r.area);
      if (!area) return null;
      return {
        area,
        kind,
        severity,
        evidence: prose(r.evidence),
        drill: prose(r.drill),
        drillSubject,
      };
    })
    .filter((w): w is Weakpoint => w !== null)
    .slice(0, 5);

  if (!asStr(o.persona) && weakpoints.length === 0) return null;

  const gain = typeof o.projectedGain === "number" ? o.projectedGain : 0;
  return {
    persona: prose(o.persona) || "Developing",
    headline: prose(o.headline),
    trajectory: prose(o.trajectory),
    strengths: strArr(o.strengths).slice(0, 3),
    weakpoints,
    focusPlan: strArr(o.focusPlan).slice(0, 3),
    projectedGain: Math.max(0, Math.round(gain * 10) / 10),
  };
}

export interface ProfileResult {
  profile: LearnerProfile | null;
  degradedReason?: string;
}

/** Generate the structured profile from longitudinal signals. */
export async function generateLearnerProfile(
  signals: LearnerSignals
): Promise<ProfileResult> {
  const { data, degradedReason } = await deepseekJSON<unknown>({
    system: PROFILE_SYSTEM_PROMPT,
    user: buildProfileUserMessage(signals),
    maxTokens: 2200,
    temperature: 0.4,
  });
  if (!data) return { profile: null, degradedReason };
  const profile = validate(data);
  return profile
    ? { profile }
    : { profile: null, degradedReason: "bad_shape" };
}
