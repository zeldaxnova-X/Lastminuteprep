-- ============================================================================
-- ROLLBACK for 20260814000000_razorpay_payments.sql
-- Drops the payment ledger table (and its own-row RLS policy, via CASCADE).
-- Idempotent.  psql "$DATABASE_URL" -f supabase/manual/rollback_20260814000000.sql
-- ============================================================================
BEGIN;
DROP TABLE IF EXISTS public.razorpay_payments CASCADE;
COMMIT;
