-- ============================================================================
-- Migration 20260810000000: Security hardening — real identity, ownership RLS,
-- anonymous-sample support, and admin gating.
--
-- Root cause being closed: the server trusted the client (DEV_USER_ID stub, no
-- ownership checks, permissive "dev" RLS policies). This migration makes the
-- DATABASE itself refuse cross-user and cross-privilege access, as the backstop
-- behind the route-level checks.
--
-- Model note: the live engine uses exam_attempts/attempt_answers (v1); the
-- M2/M3 tables (test_sessions/responses/session_results/mentor_reports) are the
-- forward model. Both get strict own-row RLS here.
-- ============================================================================

-- Wrapped in a single transaction so a failed apply auto-reverts with no
-- half-applied state (all statements below are transaction-safe — no CREATE
-- INDEX CONCURRENTLY / ALTER TYPE ADD VALUE).
BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Anonymous-sample support on exam_attempts: user_id becomes nullable and a
--    device_id companion identifies a signed-out sample (mirrors test_sessions).
-- ----------------------------------------------------------------------------
ALTER TABLE public.exam_attempts ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.exam_attempts ADD COLUMN IF NOT EXISTS device_id text;
CREATE INDEX IF NOT EXISTS idx_exam_attempts_device ON public.exam_attempts(device_id);

-- ----------------------------------------------------------------------------
-- 2. Admin flag on profiles. Granted by USER ID only (see the companion
--    migration 20260810000001), never by credentials in code.
-- ----------------------------------------------------------------------------
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

-- SECURITY DEFINER helper so RLS policies can ask "is the caller an admin?"
-- without recursing into profiles' own RLS.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE((SELECT p.is_admin FROM public.profiles p WHERE p.id = auth.uid()), false);
$$;

-- ----------------------------------------------------------------------------
-- 3. sample_attempts — server-side one-time-sample ledger keyed on a durable
--    httpOnly device token (raises re-farm effort beyond clearing localStorage).
--    No RLS policies => no client (anon/authenticated) access at all; only the
--    server (service role) reads/writes it.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sample_attempts (
    device_token   text PRIMARY KEY,
    attempt_id     uuid REFERENCES public.exam_attempts(id) ON DELETE SET NULL,
    ip             text,
    user_agent     text,
    claimed_by     uuid,
    created_at     timestamptz NOT NULL DEFAULT now(),
    claimed_at     timestamptz
);
CREATE INDEX IF NOT EXISTS idx_sample_attempts_ip ON public.sample_attempts(ip);
CREATE INDEX IF NOT EXISTS idx_sample_attempts_claimed_by ON public.sample_attempts(claimed_by);
ALTER TABLE public.sample_attempts ENABLE ROW LEVEL SECURITY;
-- (intentionally NO policies — service-role only)

-- ----------------------------------------------------------------------------
-- 4. Strict own-row RLS on every user-scoped table. Each block drops ALL
--    pre-existing policies (the permissive dev/anon/public ones from
--    20260730000009–15) then installs own-row policies. Service role bypasses
--    RLS, so anonymous sample writes still go through the server.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  t text;
  pol record;
  direct_tables text[] := ARRAY[
    'exam_attempts', 'user_analytics', 'study_sessions', 'user_bookmarks', 'question_reports'
  ];
BEGIN
  -- Drop every existing policy on the user-data + M2/M3 tables so no permissive
  -- leftover survives.
  FOREACH t IN ARRAY (direct_tables ||
      ARRAY['attempt_answers','test_sessions','responses','session_results','mentor_reports'])
  LOOP
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, t);
    END LOOP;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;

  -- Direct-ownership tables: own row where user_id = auth.uid().
  FOREACH t IN ARRAY direct_tables LOOP
    EXECUTE format($f$
      CREATE POLICY %1$s_own ON public.%1$I
        FOR ALL TO authenticated
        USING (user_id = auth.uid())
        WITH CHECK (user_id = auth.uid())
    $f$, t);
  END LOOP;
END $$;

-- Indirect-ownership tables: ownership flows through a parent row.
CREATE POLICY attempt_answers_own ON public.attempt_answers
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.exam_attempts ea
                 WHERE ea.id = attempt_answers.attempt_id AND ea.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.exam_attempts ea
                      WHERE ea.id = attempt_answers.attempt_id AND ea.user_id = auth.uid()));

-- test_sessions: own row (user_id); device-only anonymous rows are reached via
-- the service role, never the client.
CREATE POLICY test_sessions_own ON public.test_sessions
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY responses_own ON public.responses
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.test_sessions s
                 WHERE s.id = responses.session_id AND s.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.test_sessions s
                      WHERE s.id = responses.session_id AND s.user_id = auth.uid()));

CREATE POLICY session_results_own ON public.session_results
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.test_sessions s
                 WHERE s.id = session_results.session_id AND s.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.test_sessions s
                      WHERE s.id = session_results.session_id AND s.user_id = auth.uid()));

CREATE POLICY mentor_reports_own ON public.mentor_reports
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.test_sessions s
                 WHERE s.id = mentor_reports.session_id AND s.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.test_sessions s
                      WHERE s.id = mentor_reports.session_id AND s.user_id = auth.uid()));

-- ----------------------------------------------------------------------------
-- 5. Admin-only tables (ingestion / staging / review). Non-admins get nothing
--    via the client; admins (is_admin()) may read. Writes stay server-only.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  t text;
  pol record;
  admin_tables text[] := ARRAY[
    'raw_questions','manual_review_queue','ingestion_runs','import_runs',
    'pdf_ingestion_logs','paper_import_status','subject_review_queue','dataset_versions'
  ];
BEGIN
  FOREACH t IN ARRAY admin_tables LOOP
    -- Skip tables that don't exist in this environment.
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema='public' AND table_name=t) THEN
      FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, t);
      END LOOP;
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format($f$
        CREATE POLICY %1$s_admin_read ON public.%1$I
          FOR SELECT TO authenticated
          USING (public.is_admin())
      $f$, t);
    END IF;
  END LOOP;
END $$;

-- Admins may read all profiles (support/ops); own-row policies from M9 remain.
DROP POLICY IF EXISTS profiles_admin_read ON public.profiles;
CREATE POLICY profiles_admin_read ON public.profiles
  FOR SELECT TO authenticated
  USING (public.is_admin());

COMMIT;
