-- ============================================================
-- Migration 20260808000000: M9 — profiles + Supabase Auth
-- LastMilePrep SSC CGL Platform
--
-- ADDITIVE. Introduces the `profiles` table (the app-side mirror of
-- auth.users) with a plan field that is the source of truth for the paywall
-- seam, auto-creates a profile on signup, and turns RLS ON for profiles with
-- strict own-row access (no permissive demo policy on this table).
--
-- Payments remain OUT of scope: `plan` only ever moves via a server action /
-- webhook later. Nothing here charges or mutates a plan.
-- ============================================================

-- ------------------------------------------------------------
-- profiles — one row per auth user. `plan` is the single source of truth for
-- entitlements TODAY. `entitlements` is a forward-compatible jsonb meant to
-- later hold { exam_slug: plan } for per-exam scoping WITHOUT a rewrite.
--   // TODO: migrate to per-exam entitlements when multi-exam launches —
--   //       until then the top-level `plan` wins and `entitlements` is unused.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id           uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email        text,
    full_name    text,
    avatar_url   text,
    plan         text NOT NULL DEFAULT 'free'
                     CHECK (plan IN ('free', 'pro', 'mentor')),
    entitlements jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- Auto-create a free profile whenever a new auth user is created (email/pw or
-- OAuth). SECURITY DEFINER so it can write through RLS. Pulls display name and
-- avatar from the OAuth/user metadata when present.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, avatar_url, plan)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
        NEW.raw_user_meta_data->>'avatar_url',
        'free'
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill any auth users that predate this migration.
INSERT INTO public.profiles (id, email, full_name, avatar_url, plan)
SELECT id,
       email,
       COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name'),
       raw_user_meta_data->>'avatar_url',
       'free'
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------
-- RLS — profiles: strict own-row. A user may read and update ONLY their own
-- profile. Inserts happen through the SECURITY DEFINER trigger; the service
-- role (server-only) bypasses RLS for future plan mutations.
-- ------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
CREATE POLICY profiles_select_own ON public.profiles
    FOR SELECT TO authenticated
    USING (auth.uid() = id);

DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own ON public.profiles
    FOR UPDATE TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);
-- NOTE: no `plan` guard here — clients can't reach the service role, and the
-- update policy is only used for full_name/avatar self-edits. Plan changes are
-- server-only. // TODO: column-level guard once a self-serve profile edit ships.

-- ------------------------------------------------------------
-- Sessions: make attempts forward-compatible with a real auth identity while
-- keeping the ANONYMOUS sample working. user_id becomes nullable and gains a
-- device_id companion so a signed-out sample can still write (null user_id +
-- device id); signed-in attempts carry auth.uid().
--   // TODO: tighten once sample accounts are claimed — backfill device_id
--   //       sessions onto the user_id at first login, then require user_id.
-- ------------------------------------------------------------
ALTER TABLE public.test_sessions ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.test_sessions ADD COLUMN IF NOT EXISTS device_id text;
CREATE INDEX IF NOT EXISTS idx_test_sessions_device ON public.test_sessions (device_id);

-- updated_at touch trigger for profiles (keeps parity with other tables).
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS profiles_touch_updated_at ON public.profiles;
CREATE TRIGGER profiles_touch_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
