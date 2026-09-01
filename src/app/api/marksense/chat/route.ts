import { NextRequest, NextResponse } from "next/server";
import { getSessionContext, json401, serviceClient } from "@/lib/auth/api-guard";
import { getViewer, canSeeMentor } from "@/lib/auth/plan";
import { deepseekConverse, sanitizeProse, aiEnabled, type ChatMessage } from "@/lib/ai/deepseek";
import type { LearnerSignals } from "@/lib/ai/learner-signals";
import type { LearnerProfile } from "@/lib/ai/learner-profile";

const MAX_TURNS = 12; // cap history sent to the model
const MAX_LEN = 1000; // per-message char cap

/**
 * The MarksenseAI study coach: a chat assistant grounded in the user's own
 * longitudinal profile. Strictly scoped to exam preparation (doubts, study
 * plans, scoring strategy); it declines anything off-topic. Mentor-gated.
 */
function systemPrompt(signals: LearnerSignals | null, profile: LearnerProfile | null): string {
  const ctx = signals
    ? `The student's profile (use it to personalise, cite only these numbers):
- Mocks analysed: ${signals.attemptsAnalyzed}, net ${signals.score.firstNet} -> ${signals.score.latestNet} (best ${signals.score.bestNet}, trend ${signals.score.trendPerAttempt}/mock)
- Overall accuracy: ${signals.accuracy.overallPct}%
- Weak topics: ${signals.topicWeakpoints.map((t) => `${t.topic} ${t.accuracyPct}%`).join(", ") || "none yet"}
- Strong topics: ${signals.topicStrengths.map((t) => `${t.topic} ${t.accuracyPct}%`).join(", ") || "none yet"}
- Tendencies: ${signals.tendencies.calibration}, ${signals.tendencies.pacing}, avg ${signals.tendencies.avgMarksLostToBadGuessing} marks lost to bad guessing
- Persona: ${profile?.persona ?? "n/a"}`
    : "No mock history yet; give general SSC CGL guidance and encourage a first mock.";

  return `You are the MarksenseAI study coach for an SSC CGL aspirant on the LastMilePrep platform.

${ctx}

Scope, STRICT: only help with exam preparation, studying, this student's performance, study plans for their next exam, concept doubts (Quant, Reasoning, English, General Awareness), and strategies to score more marks. If the user asks about anything outside studying and exam prep (news, coding, relationships, general chit-chat, entertainment, anything unrelated), reply with exactly one short sentence declining and steering back to their prep, and nothing else.

Style:
- Warm, direct, encouraging but honest. Second person.
- Ground advice in the student's numbers above whenever relevant.
- Be concrete: name topics, give steps, small numbers they can act on.
- Keep replies tight (under ~180 words) unless building a study plan.
- Plain text or simple Markdown. No em dashes. Never claim to be a general AI.`;
}

export async function POST(req: NextRequest) {
  const { user } = await getSessionContext();
  if (!user) return json401();

  const viewer = await getViewer();
  if (!canSeeMentor(viewer.plan)) {
    return NextResponse.json({ error: "MarksenseAI required" }, { status: 403 });
  }
  if (!aiEnabled()) {
    return NextResponse.json({ reply: null, degraded: "no_api_key" });
  }

  let body: { messages?: Array<{ role: string; content: string }> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  const incoming = Array.isArray(body.messages) ? body.messages : [];
  const history: ChatMessage[] = incoming
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-MAX_TURNS)
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content.slice(0, MAX_LEN) }));

  if (history.length === 0 || history[history.length - 1].role !== "user") {
    return NextResponse.json({ error: "No user message" }, { status: 400 });
  }

  // Ground the coach in the user's stored profile (service role reads own row).
  const db = serviceClient();
  const { data: row } = await db
    .from("learner_profiles")
    .select("signals, profile")
    .eq("user_id", user.id)
    .maybeSingle();

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt((row?.signals as LearnerSignals) ?? null, (row?.profile as LearnerProfile) ?? null) },
    ...history,
  ];

  const { text, degradedReason } = await deepseekConverse(messages, { maxTokens: 1200, temperature: 0.5 });
  return NextResponse.json({
    reply: text ? sanitizeProse(text) : null,
    degraded: degradedReason ?? null,
  });
}
