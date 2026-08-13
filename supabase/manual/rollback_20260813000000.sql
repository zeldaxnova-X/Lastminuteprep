-- ============================================================================
-- ROLLBACK for 20260813000000_protect_plan_column.sql
--
-- Drops the guard trigger + function, returning profiles to the prior behavior
-- (client own-row updates could change any column, including plan/is_admin).
-- Idempotent; safe to run even if the migration only partially applied.
--   psql "$DATABASE_URL" -f supabase/manual/rollback_20260813000000.sql
-- ============================================================================
BEGIN;

DROP TRIGGER IF EXISTS trg_guard_profile_privileged_columns ON public.profiles;
DROP FUNCTION IF EXISTS public.guard_profile_privileged_columns();

COMMIT;
