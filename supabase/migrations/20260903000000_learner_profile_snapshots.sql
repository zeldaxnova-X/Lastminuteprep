-- ----------------------------------------------------------------------------
-- MarksenseAI learner-profile snapshots (evolution history).
--
-- learner_profiles holds only the LATEST profile. To show a user how they have
-- evolved, we append one immutable snapshot each time a new mock changes their
-- signals. Deduped by (user_id, signals_hash) so a manual refresh never doubles
-- a point. Self-contained (chart-ready) so the timeline needs no joins.
--
-- Writes via service role (profile builder); owners read their own history.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.learner_profile_snapshots (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    attempts_analyzed integer NOT NULL,
    signals_hash      text NOT NULL,
    persona           text,
    projected_gain    numeric,
    latest_net        numeric,
    best_net          numeric,
    avg_net           numeric,
    overall_accuracy  numeric,
    calibration       text,
    pacing            text,
    weak_topics       jsonb, -- [{ topic, accuracyPct }] top 5 at this point
    generated_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, signals_hash)
);

CREATE INDEX IF NOT EXISTS idx_profile_snapshots_user
    ON public.learner_profile_snapshots(user_id, generated_at);

ALTER TABLE public.learner_profile_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read own profile snapshots" ON public.learner_profile_snapshots;
CREATE POLICY "read own profile snapshots" ON public.learner_profile_snapshots
    FOR SELECT USING (auth.uid() = user_id);

-- Backfill one snapshot from each existing profile so current MarksenseAI users
-- see at least their starting point. Extracts chart fields from the stored
-- signals/profile JSON. Deduped by the unique constraint.
INSERT INTO public.learner_profile_snapshots (
    user_id, attempts_analyzed, signals_hash, persona, projected_gain,
    latest_net, best_net, avg_net, overall_accuracy, calibration, pacing,
    weak_topics, generated_at
)
SELECT
    lp.user_id,
    lp.attempts_analyzed,
    COALESCE(lp.signals_hash, lp.user_id::text),
    lp.profile->>'persona',
    (lp.profile->>'projectedGain')::numeric,
    (lp.signals->'score'->>'latestNet')::numeric,
    (lp.signals->'score'->>'bestNet')::numeric,
    (lp.signals->'score'->>'avgNet')::numeric,
    (lp.signals->'accuracy'->>'overallPct')::numeric,
    lp.signals->'tendencies'->>'calibration',
    lp.signals->'tendencies'->>'pacing',
    (
        SELECT jsonb_agg(jsonb_build_object('topic', t->>'topic', 'accuracyPct', t->'accuracyPct'))
        FROM jsonb_array_elements(COALESCE(lp.signals->'topicWeakpoints', '[]'::jsonb)) WITH ORDINALITY AS a(t, ord)
        WHERE ord <= 5
    ),
    COALESCE(lp.generated_at, lp.updated_at, now())
FROM public.learner_profiles lp
WHERE lp.signals IS NOT NULL
ON CONFLICT (user_id, signals_hash) DO NOTHING;

COMMENT ON TABLE public.learner_profile_snapshots IS
    'Immutable MarksenseAI profile history: one point per signals change, for the evolution timeline.';
