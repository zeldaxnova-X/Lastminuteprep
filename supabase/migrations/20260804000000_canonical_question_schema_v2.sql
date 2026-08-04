-- ============================================================================
-- Migration 20260804000000: Canonical Question Schema v2 (DOCX pipeline)
--
-- Rebuilds the question data foundation from scratch around the new DOCX
-- ingestion pipeline. The previous PDF-era dataset and its staging tables are
-- abandoned (per product decision: no backward compatibility with old data).
--
-- Design:
--   * public.questions        — canonical, scalable question table. Rich JSONB
--                               content (stem/options/solution/tricks) plus flat
--                               columns for fast filtering and full-text search.
--   * public.question_assets  — extracted images (Supabase Storage references).
--   * public.ingestion_runs   — per-document import audit trail.
--   * public.papers           — retained + enriched (still TEXT paper_id PK so
--                               exam_attempts.paper_id keeps working).
--   * public.validated_questions — REPLACED by a compatibility VIEW so the
--                               existing CBT engine, analytics, bookmarks and
--                               reports run unchanged against the new data.
--
-- This migration is destructive to old question data and to attempt history
-- that referenced it (acceptable pre-launch). It preserves the app's runtime
-- contract.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Clean slate: detach dependents from the old validated_questions table.
--    Attempt history referenced the old dataset, so it is discarded too.
-- ----------------------------------------------------------------------------
TRUNCATE TABLE public.attempt_answers CASCADE;
TRUNCATE TABLE public.user_bookmarks CASCADE;
TRUNCATE TABLE public.question_reports CASCADE;
TRUNCATE TABLE public.exam_attempts CASCADE;

ALTER TABLE public.attempt_answers  DROP CONSTRAINT IF EXISTS attempt_answers_question_id_fkey;
ALTER TABLE public.user_bookmarks   DROP CONSTRAINT IF EXISTS user_bookmarks_question_id_fkey;
ALTER TABLE public.question_reports DROP CONSTRAINT IF EXISTS question_reports_question_id_fkey;

-- The name "validated_questions" is reclaimed as a view below. It may currently
-- be either the old table (first run) or the new view (re-run), so drop whatever
-- kind actually exists.
DO $$
DECLARE kind "char";
BEGIN
    SELECT c.relkind INTO kind
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'validated_questions';
    IF kind = 'r' THEN EXECUTE 'DROP TABLE public.validated_questions CASCADE';
    ELSIF kind = 'v' THEN EXECUTE 'DROP VIEW public.validated_questions CASCADE';
    END IF;
END $$;

-- Old PDF-era staging tables are no longer part of the pipeline.
DROP TABLE IF EXISTS public.raw_questions CASCADE;
DROP TABLE IF EXISTS public.manual_review_queue CASCADE;

-- ----------------------------------------------------------------------------
-- 1. Enrich the retained papers registry.
-- ----------------------------------------------------------------------------
ALTER TABLE public.papers ADD COLUMN IF NOT EXISTS exam_date       DATE;
ALTER TABLE public.papers ADD COLUMN IF NOT EXISTS language        TEXT NOT NULL DEFAULT 'en';
ALTER TABLE public.papers ADD COLUMN IF NOT EXISTS source_document TEXT;
ALTER TABLE public.papers ADD COLUMN IF NOT EXISTS sections_order  JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.papers ADD COLUMN IF NOT EXISTS total_questions INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.papers ADD COLUMN IF NOT EXISTS ingest_stats    JSONB;
ALTER TABLE public.papers ADD COLUMN IF NOT EXISTS updated_at      TIMESTAMPTZ NOT NULL DEFAULT now();

-- ----------------------------------------------------------------------------
-- 2. Canonical questions table.
-- ----------------------------------------------------------------------------
CREATE TABLE public.questions (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    paper_id         TEXT NOT NULL REFERENCES public.papers(paper_id) ON DELETE CASCADE,
    question_number  INTEGER NOT NULL,
    external_id      TEXT,                       -- source-native id (e.g. TCS Question ID)

    section          TEXT NOT NULL CHECK (section IN (
                        'reasoning', 'general_awareness', 'quantitative_aptitude',
                        'english_comprehension', 'statistics', 'general_studies',
                        'finance_economics', 'unknown')),
    topic            TEXT,
    difficulty       TEXT CHECK (difficulty IN ('easy', 'medium', 'hard')),
    language         TEXT NOT NULL DEFAULT 'en' CHECK (language IN ('en', 'hi', 'bi')),

    -- Rich, order-preserving content (ContentBlock[] / ParsedOption[]).
    stem             JSONB NOT NULL DEFAULT '[]'::jsonb,
    stem_text        TEXT  NOT NULL DEFAULT '',
    options          JSONB NOT NULL DEFAULT '[]'::jsonb,
    has_images       BOOLEAN NOT NULL DEFAULT false,

    correct_option   CHAR(1) CHECK (correct_option IN ('A', 'B', 'C', 'D')),
    answer_source    TEXT NOT NULL DEFAULT 'unknown' CHECK (answer_source IN (
                        'official_key', 'chosen_option', 'solved_paper', 'unknown')),
    answer_status    TEXT,
    needs_answer_key BOOLEAN NOT NULL DEFAULT false,

    solution         JSONB NOT NULL DEFAULT '[]'::jsonb,
    solution_text    TEXT  NOT NULL DEFAULT '',

    -- "Trick to Higher Scores": strategic guidance, populated in a later phase.
    tricks           JSONB NOT NULL DEFAULT '[]'::jsonb,

    marks            NUMERIC NOT NULL DEFAULT 2.0,
    negative_marks   NUMERIC NOT NULL DEFAULT 0.5,

    source_document  TEXT NOT NULL,
    dataset_version  TEXT NOT NULL DEFAULT '2.0',
    warnings         JSONB NOT NULL DEFAULT '[]'::jsonb,

    -- Full-text search over stem + solution.
    search_tsv       tsvector GENERATED ALWAYS AS (
                        to_tsvector('english', coalesce(stem_text, '') || ' ' || coalesce(solution_text, ''))
                     ) STORED,

    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_questions_paper_qnum UNIQUE (paper_id, question_number)
);

CREATE INDEX idx_questions_paper        ON public.questions(paper_id);
CREATE INDEX idx_questions_section      ON public.questions(section);
CREATE INDEX idx_questions_topic        ON public.questions(topic);
CREATE INDEX idx_questions_language     ON public.questions(language);
CREATE INDEX idx_questions_difficulty   ON public.questions(difficulty);
CREATE INDEX idx_questions_needs_key    ON public.questions(needs_answer_key);
CREATE INDEX idx_questions_dataset_ver  ON public.questions(dataset_version);
CREATE INDEX idx_questions_search       ON public.questions USING GIN (search_tsv);
CREATE INDEX idx_questions_options_gin  ON public.questions USING GIN (options jsonb_path_ops);

COMMENT ON TABLE public.questions IS 'Canonical SSC question bank (DOCX pipeline v2). JSONB content + flat query columns.';
COMMENT ON COLUMN public.questions.needs_answer_key IS 'True when no trustworthy correct answer could be established; such questions must be excluded from scored exams until keyed.';

-- ----------------------------------------------------------------------------
-- 3. Question assets (images extracted from the DOCX media folder).
-- ----------------------------------------------------------------------------
CREATE TABLE public.question_assets (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id   UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
    paper_id      TEXT NOT NULL REFERENCES public.papers(paper_id) ON DELETE CASCADE,
    asset_key     TEXT NOT NULL,               -- RawAsset.id from the pipeline
    role          TEXT NOT NULL DEFAULT 'stem' CHECK (role IN ('stem', 'option', 'solution')),
    option_key    CHAR(1),
    storage_path  TEXT NOT NULL,               -- path within the Storage bucket
    public_url    TEXT,
    sha256        TEXT NOT NULL,
    ext           TEXT NOT NULL,
    byte_length   INTEGER,
    width         INTEGER,
    height        INTEGER,
    alt           TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_question_asset UNIQUE (question_id, asset_key)
);

CREATE INDEX idx_question_assets_question ON public.question_assets(question_id);
CREATE INDEX idx_question_assets_paper    ON public.question_assets(paper_id);
CREATE INDEX idx_question_assets_sha      ON public.question_assets(sha256);

-- ----------------------------------------------------------------------------
-- 4. Ingestion audit trail (one row per imported document).
-- ----------------------------------------------------------------------------
CREATE TABLE public.ingestion_runs (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_document   TEXT NOT NULL,
    paper_id          TEXT REFERENCES public.papers(paper_id) ON DELETE SET NULL,
    format            TEXT,
    dataset_version   TEXT NOT NULL DEFAULT '2.0',
    total_questions   INTEGER NOT NULL DEFAULT 0,
    with_answer       INTEGER NOT NULL DEFAULT 0,
    needs_answer_key  INTEGER NOT NULL DEFAULT 0,
    image_questions   INTEGER NOT NULL DEFAULT 0,
    total_assets      INTEGER NOT NULL DEFAULT 0,
    warnings          INTEGER NOT NULL DEFAULT 0,
    stats             JSONB,
    status            TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'partial', 'failed')),
    started_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at      TIMESTAMPTZ
);

CREATE INDEX idx_ingestion_runs_paper ON public.ingestion_runs(paper_id);

-- ----------------------------------------------------------------------------
-- 5. Backward-compatibility view: validated_questions.
--    Maps the canonical schema onto the exact columns the existing CBT engine,
--    analytics functions, bookmarks and reports expect. Option text falls back
--    to a placeholder when an option's content is an image.
-- ----------------------------------------------------------------------------
CREATE VIEW public.validated_questions AS
SELECT
    q.id,
    q.paper_id,
    p.paper_name_canonical                            AS paper_name,
    p.year,
    p.shift,
    q.section                                         AS subject,
    q.question_number,
    q.stem_text                                       AS question_text,
    NULL::text                                        AS question_image,
    COALESCE(NULLIF(q.options->0->>'text', ''), CASE WHEN (q.options->0->>'isImage')::boolean THEN '[image]' END) AS option_a,
    COALESCE(NULLIF(q.options->1->>'text', ''), CASE WHEN (q.options->1->>'isImage')::boolean THEN '[image]' END) AS option_b,
    COALESCE(NULLIF(q.options->2->>'text', ''), CASE WHEN (q.options->2->>'isImage')::boolean THEN '[image]' END) AS option_c,
    COALESCE(NULLIF(q.options->3->>'text', ''), CASE WHEN (q.options->3->>'isImage')::boolean THEN '[image]' END) AS option_d,
    q.correct_option                                  AS correct_answer,
    q.solution_text                                   AS official_explanation,
    q.marks,
    q.negative_marks,
    q.source_document                                 AS source_pdf,
    q.dataset_version
FROM public.questions q
JOIN public.papers p ON p.paper_id = q.paper_id;

COMMENT ON VIEW public.validated_questions IS 'Compatibility view over public.questions for the pre-existing CBT engine/analytics. New code should read public.questions directly.';

-- ----------------------------------------------------------------------------
-- 6. Re-point attempt/bookmark/report FKs at the canonical questions table.
-- ----------------------------------------------------------------------------
ALTER TABLE public.attempt_answers
    ADD CONSTRAINT attempt_answers_question_id_fkey
    FOREIGN KEY (question_id) REFERENCES public.questions(id) ON DELETE CASCADE;

ALTER TABLE public.user_bookmarks
    ADD CONSTRAINT user_bookmarks_question_id_fkey
    FOREIGN KEY (question_id) REFERENCES public.questions(id) ON DELETE CASCADE;

ALTER TABLE public.question_reports
    ADD CONSTRAINT question_reports_question_id_fkey
    FOREIGN KEY (question_id) REFERENCES public.questions(id) ON DELETE CASCADE;

-- ----------------------------------------------------------------------------
-- 7. Row Level Security: public read for content, mirroring existing policy.
-- ----------------------------------------------------------------------------
ALTER TABLE public.questions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read questions" ON public.questions;
CREATE POLICY "Public read questions" ON public.questions
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read question_assets" ON public.question_assets;
CREATE POLICY "Public read question_assets" ON public.question_assets
    FOR SELECT USING (true);

-- ----------------------------------------------------------------------------
-- 8. Register dataset version 2.0 (DOCX pipeline).
-- ----------------------------------------------------------------------------
INSERT INTO public.dataset_versions (id, dataset_version, dataset_name, total_questions, total_papers, status, notes)
VALUES (gen_random_uuid(), '2.0', 'SSC CGL Question Bank v2.0 (DOCX pipeline)', 0, 0, 'ACTIVE',
        'Clean canonical schema. Source of truth: manually extracted DOCX files.')
ON CONFLICT (dataset_version) DO NOTHING;
