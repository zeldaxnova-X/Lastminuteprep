-- ROLLBACK for 20260925000300_sbi_clerk_prelims.sql. Idempotent.
--   psql "$DATABASE_URL" -f supabase/manual/rollback_20260925000300.sql
BEGIN;
DROP VIEW IF EXISTS public.sbi_clerk__cbt_valid_questions;
DROP VIEW IF EXISTS public.sbi_clerk__validated_questions;
DROP SCHEMA IF EXISTS sbi_clerk CASCADE;
DELETE FROM public.exams WHERE slug = 'sbi-clerk-prelims';
-- Restore the A–D-only answer checks (safe: SSC never used E).
ALTER TABLE public.attempt_answers DROP CONSTRAINT IF EXISTS attempt_answers_selected_option_check;
ALTER TABLE public.attempt_answers ADD  CONSTRAINT attempt_answers_selected_option_check
  CHECK (selected_option = ANY (ARRAY['A','B','C','D']));
ALTER TABLE public.responses DROP CONSTRAINT IF EXISTS responses_selected_option_check;
ALTER TABLE public.responses ADD  CONSTRAINT responses_selected_option_check
  CHECK (selected_option = ANY (ARRAY['A','B','C','D']::bpchar[]));
COMMIT;
