-- ============================================================================
-- Migration 20260925000400: allow 'memory_based' paper_type in sbi_clerk.papers
-- SBI papers are memory-based reconstructions. The paper_type CHECK was copied
-- from SSC (which has no such value). Widen it for the SBI content table only.
-- Rollback: revert to the SSC value list (see rollback_20260925000400.sql).
-- ============================================================================
BEGIN;
DO $$
DECLARE cn text;
BEGIN
  SELECT conname INTO cn FROM pg_constraint
   WHERE conrelid = 'sbi_clerk.papers'::regclass AND contype = 'c'
     AND pg_get_constraintdef(oid) ILIKE '%paper_type%';
  IF cn IS NOT NULL THEN EXECUTE format('ALTER TABLE sbi_clerk.papers DROP CONSTRAINT %I', cn); END IF;
END $$;
ALTER TABLE sbi_clerk.papers ADD CONSTRAINT sbi_papers_paper_type_check
  CHECK (paper_type = ANY (ARRAY[
    'official_question_paper','tcs_response_sheet','official_answer_key','solved_book',
    'similar_practice_paper','candidate_summary','incomplete_scan','unsupported_document','memory_based'
  ]));

-- sbi_clerk.questions.section CHECK was copied from SSC (SSC section slugs only).
-- Replace it with SBI's own sections; and year may be null on memory-based papers.
DO $$
DECLARE cn text;
BEGIN
  SELECT conname INTO cn FROM pg_constraint
   WHERE conrelid = 'sbi_clerk.questions'::regclass AND contype = 'c'
     AND pg_get_constraintdef(oid) ILIKE '%section%';
  IF cn IS NOT NULL THEN EXECUTE format('ALTER TABLE sbi_clerk.questions DROP CONSTRAINT %I', cn); END IF;
END $$;
ALTER TABLE sbi_clerk.questions ADD CONSTRAINT sbi_questions_section_check
  CHECK (section = ANY (ARRAY['english','numerical_ability','reasoning']));
ALTER TABLE sbi_clerk.papers ALTER COLUMN year DROP NOT NULL;
COMMIT;
