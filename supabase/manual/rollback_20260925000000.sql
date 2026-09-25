-- ============================================================================
-- ROLLBACK for 20260925000000_free_mock_funnel.sql
-- Reverts the free-mock funnel schema. Idempotent.
--   psql "$DATABASE_URL" -f supabase/manual/rollback_20260925000000.sql
--
-- NOTE: test_sessions.user_id is intentionally NOT restored to NOT NULL here —
-- doing so would fail if any anonymous rows exist, and nullable is harmless. The
-- device_id column and the new tables/function are dropped.
-- ============================================================================
BEGIN;

DROP FUNCTION IF EXISTS public.claim_anonymous_attempts(uuid, text);
DROP TABLE IF EXISTS public.anon_mock_ledger CASCADE;
DROP TABLE IF EXISTS public.analytics_events CASCADE;
DROP TABLE IF EXISTS public.report_unlocks CASCADE;

DROP INDEX IF EXISTS public.idx_test_sessions_device;
ALTER TABLE public.test_sessions DROP COLUMN IF EXISTS device_id;

COMMIT;
