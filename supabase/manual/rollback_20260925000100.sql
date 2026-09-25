-- ROLLBACK for 20260925000100_exam_code_on_attempts.sql. Idempotent.
--   psql "$DATABASE_URL" -f supabase/manual/rollback_20260925000100.sql
BEGIN;
DROP INDEX IF EXISTS public.idx_exam_attempts_exam_code;
ALTER TABLE public.exam_attempts DROP COLUMN IF EXISTS exam_code;
COMMIT;
