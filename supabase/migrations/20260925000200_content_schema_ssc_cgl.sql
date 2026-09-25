-- ============================================================================
-- Migration 20260925000200: hard-isolate content into a per-exam schema (SSC).
--
-- Multi-exam isolation, step 3. Moves the SSC content base tables into the
-- `ssc_cgl` schema so a second exam's content (sbi_clerk.*) is PHYSICALLY
-- separate — cross-exam leakage becomes impossible, not policy-dependent.
--
-- ZERO app impact: `public` compatibility views keep the existing base-table
-- names working unchanged (SSC is the default exam). The derived views
-- (validated_questions, cbt_valid_questions) and the picker RPC bind by OID, so
-- they keep working after the move with no edits.
--
-- Polymorphic FKs (shared attempt/response/bookmark/report tables → content) are
-- dropped: those tables span ALL exams, so they can't FK to one exam's content
-- table. Their references become soft (UUID) refs, enforced by the exam-scoped
-- repository + guardrail tests. Intra-content FKs move with the tables and stay.
--
-- Reversible: supabase/manual/rollback_20260925000200.sql. Verify row counts +
-- content checksum before/after (the apply script does this).
-- ============================================================================
BEGIN;

CREATE SCHEMA IF NOT EXISTS ssc_cgl;

-- 1. Drop polymorphic (cross-exam) FKs from shared tables to content.
ALTER TABLE public.responses        DROP CONSTRAINT IF EXISTS responses_question_id_fkey;
ALTER TABLE public.attempt_answers  DROP CONSTRAINT IF EXISTS attempt_answers_question_id_fkey;
ALTER TABLE public.user_bookmarks   DROP CONSTRAINT IF EXISTS user_bookmarks_question_id_fkey;
ALTER TABLE public.question_reports DROP CONSTRAINT IF EXISTS question_reports_question_id_fkey;
ALTER TABLE public.exam_attempts    DROP CONSTRAINT IF EXISTS exam_attempts_paper_id_fkey;
ALTER TABLE public.ingestion_runs   DROP CONSTRAINT IF EXISTS ingestion_runs_paper_id_fkey;

-- 2. Move content base tables into ssc_cgl (OID-preserving). Intra-content FKs
--    (questions→papers, question_assets→questions/papers) and the public derived
--    views + picker RPC continue to work (OID-bound).
ALTER TABLE public.papers             SET SCHEMA ssc_cgl;
ALTER TABLE public.questions          SET SCHEMA ssc_cgl;
ALTER TABLE public.question_assets    SET SCHEMA ssc_cgl;
ALTER TABLE public.excluded_questions SET SCHEMA ssc_cgl;

-- 3. public compatibility shims (SSC is the default exam). Existing .from()
--    reads keep working. Auto-updatable simple views so script writes pass
--    through (ingestion is being parameterised to target the schema directly).
CREATE VIEW public.papers             AS SELECT * FROM ssc_cgl.papers;
CREATE VIEW public.questions          AS SELECT * FROM ssc_cgl.questions;
CREATE VIEW public.question_assets    AS SELECT * FROM ssc_cgl.question_assets;
CREATE VIEW public.excluded_questions AS SELECT * FROM ssc_cgl.excluded_questions;

COMMIT;
