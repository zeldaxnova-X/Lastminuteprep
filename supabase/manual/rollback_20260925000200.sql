-- ============================================================================
-- ROLLBACK for 20260925000200_content_schema_ssc_cgl.sql
-- Moves SSC content back to public and restores the polymorphic FKs. Assumes no
-- second exam has been added yet (SSC-only data). Idempotent-ish.
--   psql "$DATABASE_URL" -f supabase/manual/rollback_20260925000200.sql
-- ============================================================================
BEGIN;

-- Drop the public compat shims so the base-table names are free again.
DROP VIEW IF EXISTS public.papers;
DROP VIEW IF EXISTS public.questions;
DROP VIEW IF EXISTS public.question_assets;
DROP VIEW IF EXISTS public.excluded_questions;

-- Move content base tables back to public.
ALTER TABLE ssc_cgl.papers             SET SCHEMA public;
ALTER TABLE ssc_cgl.questions          SET SCHEMA public;
ALTER TABLE ssc_cgl.question_assets    SET SCHEMA public;
ALTER TABLE ssc_cgl.excluded_questions SET SCHEMA public;

-- Restore polymorphic FKs (valid because data is SSC-only at rollback time).
ALTER TABLE public.responses        ADD CONSTRAINT responses_question_id_fkey        FOREIGN KEY (question_id) REFERENCES public.questions(id) ON DELETE CASCADE;
ALTER TABLE public.attempt_answers  ADD CONSTRAINT attempt_answers_question_id_fkey  FOREIGN KEY (question_id) REFERENCES public.questions(id) ON DELETE CASCADE;
ALTER TABLE public.user_bookmarks   ADD CONSTRAINT user_bookmarks_question_id_fkey   FOREIGN KEY (question_id) REFERENCES public.questions(id) ON DELETE CASCADE;
ALTER TABLE public.question_reports ADD CONSTRAINT question_reports_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.questions(id) ON DELETE CASCADE;
ALTER TABLE public.exam_attempts    ADD CONSTRAINT exam_attempts_paper_id_fkey       FOREIGN KEY (paper_id)    REFERENCES public.papers(paper_id);
ALTER TABLE public.ingestion_runs   ADD CONSTRAINT ingestion_runs_paper_id_fkey      FOREIGN KEY (paper_id)    REFERENCES public.papers(paper_id);

DROP SCHEMA IF EXISTS ssc_cgl;

COMMIT;
