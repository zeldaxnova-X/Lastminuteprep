import { NextResponse } from "next/server";
import { getSessionContext, json401 } from "@/lib/auth/api-guard";
import { getViewer, canSeeMentor } from "@/lib/auth/plan";

interface SnapshotRow {
  attempts_analyzed: number;
  persona: string | null;
  projected_gain: number | null;
  latest_net: number | null;
  best_net: number | null;
  avg_net: number | null;
  overall_accuracy: number | null;
  calibration: string | null;
  pacing: string | null;
  weak_topics: Array<{ topic: string; accuracyPct: number }> | null;
  generated_at: string;
}

/**
 * GET /api/marksense/timeline
 * The signed-in user's MarksenseAI evolution: an ordered snapshot series plus a
 * computed weakpoint diff (resolved / persistent / new) and persona changes.
 * Mentor-gated. Reads via the user-scoped client (RLS restricts to own rows).
 */
export async function GET() {
  const { user, supabase } = await getSessionContext();
  if (!user) return json401();

  const viewer = await getViewer();
  if (!canSeeMentor(viewer.plan)) {
    return NextResponse.json({ locked: true, plan: viewer.plan }, { status: 200 });
  }

  const { data: rows } = await supabase
    .from("learner_profile_snapshots")
    .select(
      "attempts_analyzed, persona, projected_gain, latest_net, best_net, avg_net, overall_accuracy, calibration, pacing, weak_topics, generated_at"
    )
    .eq("user_id", user.id)
    .order("generated_at", { ascending: true })
    .returns<SnapshotRow[]>();

  const series = (rows ?? []).map((r) => ({
    attemptsAnalyzed: r.attempts_analyzed,
    persona: r.persona,
    projectedGain: r.projected_gain,
    latestNet: r.latest_net,
    bestNet: r.best_net,
    avgNet: r.avg_net,
    overallAccuracy: r.overall_accuracy,
    calibration: r.calibration,
    pacing: r.pacing,
    weakTopics: r.weak_topics ?? [],
    generatedAt: r.generated_at,
  }));

  // Persona changes: keep the first appearance of each new persona value.
  const personaChanges: Array<{ persona: string; generatedAt: string; attemptsAnalyzed: number }> = [];
  let lastPersona: string | null = null;
  for (const s of series) {
    if (s.persona && s.persona !== lastPersona) {
      personaChanges.push({ persona: s.persona, generatedAt: s.generatedAt, attemptsAnalyzed: s.attemptsAnalyzed });
      lastPersona = s.persona;
    }
  }

  // Weakpoint evolution: compare the earliest vs latest snapshot topic sets.
  const first = series[0];
  const last = series[series.length - 1];
  const firstTopics = new Map((first?.weakTopics ?? []).map((t) => [t.topic, t.accuracyPct]));
  const lastTopics = new Map((last?.weakTopics ?? []).map((t) => [t.topic, t.accuracyPct]));

  const resolved: Array<{ topic: string; wasPct: number }> = [];
  const persistent: Array<{ topic: string; fromPct: number; toPct: number }> = [];
  const emerged: Array<{ topic: string; nowPct: number }> = [];

  if (series.length >= 2) {
    for (const [topic, wasPct] of firstTopics) {
      if (lastTopics.has(topic)) {
        persistent.push({ topic, fromPct: wasPct, toPct: lastTopics.get(topic)! });
      } else {
        resolved.push({ topic, wasPct });
      }
    }
    for (const [topic, nowPct] of lastTopics) {
      if (!firstTopics.has(topic)) emerged.push({ topic, nowPct });
    }
  }

  return NextResponse.json({
    locked: false,
    points: series.length,
    series,
    personaChanges,
    evolution: { resolved, persistent, emerged },
  });
}
