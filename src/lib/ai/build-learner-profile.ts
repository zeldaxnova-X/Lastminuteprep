/**
 * Server bridge for the MarksenseAI learner profile. Aggregates a user's
 * cross-attempt signals, (re)generates the AI profile when it has materially
 * changed, and upserts `learner_profiles`. Idempotent and cheap on the no-op
 * path: if the signals hash matches the stored one and `force` is false, it
 * refreshes the signals but skips the paid AI call.
 *
 * All writes use the caller's client (service role from the API route). Degrades
 * gracefully: with no DEEPSEEK_API_KEY it still stores the deterministic signals
 * so the dashboard can render the numeric profile without the AI narrative.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  loadLearnerSignals,
  signalsHash,
  type LearnerSignals,
} from "./learner-signals";
import { generateLearnerProfile, type LearnerProfile } from "./learner-profile";
import { aiEnabled } from "./deepseek";

export interface LearnerProfileRow {
  signals: LearnerSignals | null;
  profile: LearnerProfile | null;
  attemptsAnalyzed: number;
  generatedAt: string | null;
  stale: boolean;
  aiAvailable: boolean;
}

interface BuildResult {
  ok: boolean;
  reason?: string;
  regenerated: boolean;
  row?: LearnerProfileRow;
}

const MODEL = process.env.DEEPSEEK_MODEL || "deepseek-chat";

/**
 * Append an immutable evolution snapshot. Deduped by (user_id, signals_hash):
 * a manual refresh at the same signals state is a no-op, so one point lands per
 * new mock. Chart-ready fields, no joins needed to render the timeline.
 */
async function snapshotProfile(
  supabase: SupabaseClient,
  userId: string,
  signals: LearnerSignals,
  hash: string,
  profile: LearnerProfile | null
): Promise<void> {
  await supabase.from("learner_profile_snapshots").upsert(
    {
      user_id: userId,
      attempts_analyzed: signals.attemptsAnalyzed,
      signals_hash: hash,
      persona: profile?.persona ?? null,
      projected_gain: profile?.projectedGain ?? null,
      latest_net: signals.score.latestNet,
      best_net: signals.score.bestNet,
      avg_net: signals.score.avgNet,
      overall_accuracy: signals.accuracy.overallPct,
      calibration: signals.tendencies.calibration,
      pacing: signals.tendencies.pacing,
      weak_topics: signals.topicWeakpoints
        .slice(0, 5)
        .map((t) => ({ topic: t.topic, accuracyPct: t.accuracyPct })),
    },
    { onConflict: "user_id,signals_hash", ignoreDuplicates: true }
  );
}

/**
 * Ensure a fresh profile exists for the user.
 * @param force  regenerate the AI profile even if the signals hash is unchanged.
 */
export async function buildLearnerProfile(
  supabase: SupabaseClient,
  userId: string,
  force = false
): Promise<BuildResult> {
  const signals = await loadLearnerSignals(supabase, userId);
  if (!signals) return { ok: false, reason: "no analyzed attempts", regenerated: false };

  const hash = signalsHash(signals);

  const { data: existing } = await supabase
    .from("learner_profiles")
    .select("profile, signals_hash, generated_at")
    .eq("user_id", userId)
    .maybeSingle();

  const unchanged = existing?.signals_hash === hash && !!existing?.profile;

  // Fast path: nothing material changed and we already have an AI profile.
  if (unchanged && !force) {
    await supabase
      .from("learner_profiles")
      .update({ signals, stale: false, updated_at: new Date().toISOString() })
      .eq("user_id", userId);
    await snapshotProfile(supabase, userId, signals, hash, (existing.profile as LearnerProfile) ?? null);
    return {
      ok: true,
      regenerated: false,
      row: {
        signals,
        profile: (existing.profile as LearnerProfile) ?? null,
        attemptsAnalyzed: signals.attemptsAnalyzed,
        generatedAt: (existing.generated_at as string) ?? null,
        stale: false,
        aiAvailable: aiEnabled(),
      },
    };
  }

  // Regenerate the AI profile (or store signals-only if the provider is off).
  const { profile } = await generateLearnerProfile(signals);
  const now = new Date().toISOString();

  await supabase.from("learner_profiles").upsert(
    {
      user_id: userId,
      signals,
      // Keep a prior good profile if the AI call degraded this time.
      ...(profile
        ? { profile, model: MODEL, generated_at: now }
        : {}),
      attempts_analyzed: signals.attemptsAnalyzed,
      signals_hash: hash,
      stale: false,
      updated_at: now,
    },
    { onConflict: "user_id" }
  );

  const storedProfile =
    profile ?? ((existing?.profile as LearnerProfile | undefined) ?? null);

  await snapshotProfile(supabase, userId, signals, hash, storedProfile);

  return {
    ok: true,
    regenerated: !!profile,
    row: {
      signals,
      profile: storedProfile,
      attemptsAnalyzed: signals.attemptsAnalyzed,
      generatedAt: profile ? now : ((existing?.generated_at as string) ?? null),
      stale: false,
      aiAvailable: aiEnabled(),
    },
  };
}

/**
 * Mark a user's profile stale (cheap) so the next dashboard load refreshes it.
 * Called from the hot submit path so we never run a paid AI call inline.
 */
export async function markProfileStale(
  supabase: SupabaseClient,
  userId: string
): Promise<void> {
  await supabase
    .from("learner_profiles")
    .update({ stale: true, updated_at: new Date().toISOString() })
    .eq("user_id", userId);
}
