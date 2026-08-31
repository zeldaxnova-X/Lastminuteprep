-- ----------------------------------------------------------------------------
-- MarksenseAI learner profiles.
--
-- One evolving row per user: a longitudinal profile built by AI across EVERY
-- mock the user has completed, not a single attempt. `signals` is the
-- deterministic cross-attempt aggregate (source of truth for numbers);
-- `profile` is the AI-structured read (persona, ranked weakpoints with a drill
-- each, trajectory, focus plan); `narrative_md` is the warm prose version.
--
-- Regenerated after each new mock. `attempts_analyzed` + `signals_hash` let the
-- refresher skip a costly AI call when nothing material changed. Writes happen
-- only via the service role; owners may read their own row.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.learner_profiles (
    user_id           uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    signals           jsonb NOT NULL,
    profile           jsonb,
    narrative_md      text,
    attempts_analyzed integer NOT NULL DEFAULT 0,
    signals_hash      text,
    model             text,
    stale             boolean NOT NULL DEFAULT false,
    generated_at      timestamptz,
    updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_learner_profiles_stale
    ON public.learner_profiles(stale) WHERE stale = true;

ALTER TABLE public.learner_profiles ENABLE ROW LEVEL SECURITY;

-- Owners may read their own profile. All writes go through the service role
-- (signals aggregation + AI generation), never from the client.
DROP POLICY IF EXISTS "read own learner profile" ON public.learner_profiles;
CREATE POLICY "read own learner profile" ON public.learner_profiles
    FOR SELECT USING (auth.uid() = user_id);

COMMENT ON TABLE public.learner_profiles IS
    'MarksenseAI longitudinal learner profile: deterministic cross-attempt signals + AI-structured weakpoints/persona/plan. One row per user.';
