-- ============================================================================
-- Migration 20260925000500: per-exam public pass-through views for the SBI
-- content repository. content-repo.ts reads `<code>__<object>` in public; SBI
-- needs the raw questions/papers/etc. exposed (the validated/cbt views already
-- exist from 20260925000300). Each view selects from exactly one schema, so it
-- cannot contain another exam's rows.
-- Rollback: drop these views.
-- ============================================================================
BEGIN;
CREATE OR REPLACE VIEW public.sbi_clerk__questions          AS SELECT * FROM sbi_clerk.questions;
CREATE OR REPLACE VIEW public.sbi_clerk__papers            AS SELECT * FROM sbi_clerk.papers;
CREATE OR REPLACE VIEW public.sbi_clerk__question_assets   AS SELECT * FROM sbi_clerk.question_assets;
CREATE OR REPLACE VIEW public.sbi_clerk__excluded_questions AS SELECT * FROM sbi_clerk.excluded_questions;
COMMIT;
