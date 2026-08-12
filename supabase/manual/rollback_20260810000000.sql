-- ============================================================================
-- ROLLBACK for 20260810000000_security_hardening.sql
--
-- Purpose: a proven, one-shot revert to run if applying the security-hardening
-- migration to prod errors or misbehaves. Because that migration is NOT cleanly
-- reversible on its own (it DROPs the pre-existing permissive policies, whose
-- definitions live only in the original migrations), this script both:
--   (a) drops every NEW object/policy 20260810000000 created, and
--   (b) RE-APPLIES the original policies (from 20260730000007 / …009–015 and
--       the M2 20260805000000 demo policies) so client behavior returns to
--       exactly what it was before — NOT left deny-all.
--
-- This file is intentionally NOT a numbered migration: it lives in
-- supabase/manual/ so `supabase db push` never auto-runs it. Apply by hand:
--   psql "$DATABASE_URL" -f supabase/manual/rollback_20260810000000.sql
--
-- Idempotent / defensive: every drop uses IF EXISTS; table-scoped blocks skip
-- tables that don't exist in the target environment.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- (a1) Drop the NEW own-row / admin policies created by 20260810000000.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS exam_attempts_own    ON public.exam_attempts;
DROP POLICY IF EXISTS user_analytics_own   ON public.user_analytics;
DROP POLICY IF EXISTS study_sessions_own   ON public.study_sessions;
DROP POLICY IF EXISTS user_bookmarks_own   ON public.user_bookmarks;
DROP POLICY IF EXISTS question_reports_own ON public.question_reports;

DROP POLICY IF EXISTS attempt_answers_own  ON public.attempt_answers;
DROP POLICY IF EXISTS test_sessions_own    ON public.test_sessions;
DROP POLICY IF EXISTS responses_own        ON public.responses;
DROP POLICY IF EXISTS session_results_own  ON public.session_results;
DROP POLICY IF EXISTS mentor_reports_own   ON public.mentor_reports;

DROP POLICY IF EXISTS profiles_admin_read  ON public.profiles;

-- Admin/staging tables: drop the admin_read policy AND restore prior RLS state.
-- These tables had NO RLS and NO policies before 20260810000000, EXCEPT
-- dataset_versions (RLS on, public-select policy). Restore accordingly.
DO $$
DECLARE
  t text;
  -- Tables that had RLS DISABLED and no policies before the migration.
  no_rls_tables text[] := ARRAY[
    'raw_questions','manual_review_queue','ingestion_runs','import_runs',
    'pdf_ingestion_logs','paper_import_status','subject_review_queue'
  ];
BEGIN
  FOREACH t IN ARRAY no_rls_tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema='public' AND table_name=t) THEN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_admin_read', t);
      -- Prior state: RLS was never enabled on these.
      EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY', t);
    END IF;
  END LOOP;
END $$;

-- dataset_versions: RLS stays ENABLED (its pre-migration state); swap the
-- admin_read policy back for the original public-select policy.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='dataset_versions') THEN
    DROP POLICY IF EXISTS dataset_versions_admin_read ON public.dataset_versions;
    DROP POLICY IF EXISTS "Allow public select on dataset_versions" ON public.dataset_versions;
    CREATE POLICY "Allow public select on dataset_versions"
        ON public.dataset_versions FOR SELECT
        TO anon, authenticated
        USING (true);
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- (a2) Drop the NEW schema objects created by 20260810000000.
-- ----------------------------------------------------------------------------
-- sample_attempts (RLS-only ledger). CASCADE clears its indexes.
DROP TABLE IF EXISTS public.sample_attempts CASCADE;

-- is_admin() helper.
DROP FUNCTION IF EXISTS public.is_admin();

-- profiles.is_admin column.
ALTER TABLE public.profiles DROP COLUMN IF EXISTS is_admin;

-- exam_attempts.device_id column + its index.
DROP INDEX IF EXISTS public.idx_exam_attempts_device;
ALTER TABLE public.exam_attempts DROP COLUMN IF EXISTS device_id;

-- Restore exam_attempts.user_id NOT NULL — but only if it's safe (no anonymous
-- sample rows were written while the migration was live). If nulls exist we
-- leave it nullable and emit a NOTICE rather than fail the whole rollback.
DO $$
DECLARE
  null_count bigint;
BEGIN
  SELECT count(*) INTO null_count FROM public.exam_attempts WHERE user_id IS NULL;
  IF null_count = 0 THEN
    ALTER TABLE public.exam_attempts ALTER COLUMN user_id SET NOT NULL;
  ELSE
    RAISE NOTICE 'exam_attempts.user_id left NULLABLE: % anonymous-sample row(s) with NULL user_id exist. Resolve those before re-adding NOT NULL.', null_count;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- (b) RE-APPLY the original policies so prior client behavior is fully restored.
--     Source of truth: 20260730000007 (own-row), 20260730000015 (dev-permissive
--     FOR ALL USING(true)), and 20260805000000 (M2 demo_all_* USING(true)).
-- ----------------------------------------------------------------------------

-- NOTE: every re-created policy is preceded by DROP POLICY IF EXISTS so this
-- section is idempotent and safe even if the forward migration never ran (or
-- fully auto-reverted), in which case the originals still exist.

-- exam_attempts: own-row (007) + dev-permissive (015)
DROP POLICY IF EXISTS "Users can view own exam_attempts" ON public.exam_attempts;
CREATE POLICY "Users can view own exam_attempts"
    ON public.exam_attempts FOR SELECT TO authenticated
    USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can create own exam_attempts" ON public.exam_attempts;
CREATE POLICY "Users can create own exam_attempts"
    ON public.exam_attempts FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own exam_attempts" ON public.exam_attempts;
CREATE POLICY "Users can update own exam_attempts"
    ON public.exam_attempts FOR UPDATE TO authenticated
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Dev insert on exam_attempts" ON public.exam_attempts;
CREATE POLICY "Dev insert on exam_attempts"
    ON public.exam_attempts FOR ALL TO anon, authenticated
    USING (true) WITH CHECK (true);

-- attempt_answers: own-via-parent (007) + dev-permissive (015)
DROP POLICY IF EXISTS "Users can view own attempt_answers" ON public.attempt_answers;
CREATE POLICY "Users can view own attempt_answers"
    ON public.attempt_answers FOR SELECT TO authenticated
    USING (attempt_id IN (SELECT id FROM public.exam_attempts WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can create own attempt_answers" ON public.attempt_answers;
CREATE POLICY "Users can create own attempt_answers"
    ON public.attempt_answers FOR INSERT TO authenticated
    WITH CHECK (attempt_id IN (SELECT id FROM public.exam_attempts WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can update own attempt_answers" ON public.attempt_answers;
CREATE POLICY "Users can update own attempt_answers"
    ON public.attempt_answers FOR UPDATE TO authenticated
    USING (attempt_id IN (SELECT id FROM public.exam_attempts WHERE user_id = auth.uid()))
    WITH CHECK (attempt_id IN (SELECT id FROM public.exam_attempts WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "Dev insert on attempt_answers" ON public.attempt_answers;
CREATE POLICY "Dev insert on attempt_answers"
    ON public.attempt_answers FOR ALL TO anon, authenticated
    USING (true) WITH CHECK (true);

-- user_bookmarks: own-row (007) + dev-permissive (015)
DROP POLICY IF EXISTS "Users can view own bookmarks" ON public.user_bookmarks;
CREATE POLICY "Users can view own bookmarks"
    ON public.user_bookmarks FOR SELECT TO authenticated
    USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can create bookmarks" ON public.user_bookmarks;
CREATE POLICY "Users can create bookmarks"
    ON public.user_bookmarks FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own bookmarks" ON public.user_bookmarks;
CREATE POLICY "Users can delete own bookmarks"
    ON public.user_bookmarks FOR DELETE TO authenticated
    USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Dev insert on user_bookmarks" ON public.user_bookmarks;
CREATE POLICY "Dev insert on user_bookmarks"
    ON public.user_bookmarks FOR ALL TO anon, authenticated
    USING (true) WITH CHECK (true);

-- user_analytics: own-row (007) + dev-permissive (015)
DROP POLICY IF EXISTS "Users can view own analytics" ON public.user_analytics;
CREATE POLICY "Users can view own analytics"
    ON public.user_analytics FOR SELECT TO authenticated
    USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own analytics" ON public.user_analytics;
CREATE POLICY "Users can insert own analytics"
    ON public.user_analytics FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own analytics" ON public.user_analytics;
CREATE POLICY "Users can update own analytics"
    ON public.user_analytics FOR UPDATE TO authenticated
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Dev insert on user_analytics" ON public.user_analytics;
CREATE POLICY "Dev insert on user_analytics"
    ON public.user_analytics FOR ALL TO anon, authenticated
    USING (true) WITH CHECK (true);

-- study_sessions: own-row only (007)
DROP POLICY IF EXISTS "Users can view own study_sessions" ON public.study_sessions;
CREATE POLICY "Users can view own study_sessions"
    ON public.study_sessions FOR SELECT TO authenticated
    USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can create study_sessions" ON public.study_sessions;
CREATE POLICY "Users can create study_sessions"
    ON public.study_sessions FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own study_sessions" ON public.study_sessions;
CREATE POLICY "Users can update own study_sessions"
    ON public.study_sessions FOR UPDATE TO authenticated
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- question_reports: own-row only (007)
DROP POLICY IF EXISTS "Users can view own reports" ON public.question_reports;
CREATE POLICY "Users can view own reports"
    ON public.question_reports FOR SELECT TO authenticated
    USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can create reports" ON public.question_reports;
CREATE POLICY "Users can create reports"
    ON public.question_reports FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- M2/M3 tables: original demo_all_* permissive policies (20260805000000)
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['test_sessions','responses','session_results','mentor_reports'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'demo_all_' || t, t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)',
      'demo_all_' || t, t
    );
  END LOOP;
END $$;

COMMIT;

-- ============================================================================
-- Post-rollback note: the companion migration 20260810000001_grant_admin.sql
-- only sets profiles.is_admin=true for one id. Dropping the is_admin column
-- above removes its effect entirely, so no separate revert of …0001 is needed.
-- ============================================================================
