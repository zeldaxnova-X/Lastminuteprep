-- ============================================================================
-- Migration 20260925000100: exam_code on attempts (multi-exam isolation, step 1)
--
-- ADDITIVE + SAFE. An attempt is single-exam by nature, so it carries an
-- exam_code. Existing rows are all SSC CGL; backfill then set DEFAULT + NOT NULL
-- so every existing insert path (which doesn't set exam_code yet) keeps working
-- and is correctly tagged. No behaviour change for the running app.
--
-- Rollback: supabase/manual/rollback_20260925000100.sql
-- ============================================================================
BEGIN;

ALTER TABLE public.exam_attempts ADD COLUMN IF NOT EXISTS exam_code text;
UPDATE public.exam_attempts SET exam_code = 'ssc-cgl' WHERE exam_code IS NULL;
ALTER TABLE public.exam_attempts ALTER COLUMN exam_code SET DEFAULT 'ssc-cgl';
ALTER TABLE public.exam_attempts ALTER COLUMN exam_code SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_exam_attempts_exam_code ON public.exam_attempts(exam_code);

COMMENT ON COLUMN public.exam_attempts.exam_code IS
  'Exam this attempt belongs to (e.g. ssc-cgl, sbi-clerk). Resolves the exam config + content namespace. Single-exam per attempt.';

COMMIT;
