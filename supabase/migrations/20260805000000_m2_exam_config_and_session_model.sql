-- ============================================================
-- Migration 20260805000000: M2 — ExamConfig + canonical session model
-- LastMilePrep SSC CGL Platform
--
-- ADDITIVE ONLY. Does NOT touch the ingestion pipeline or its tables
-- (papers, questions, question_assets, ingestion_runs) beyond READING them
-- to seed data-driven PYP templates.
--
-- Canonical session model per spec §7:
--   exams, test_templates, test_sessions, responses, session_results,
--   mentor_reports.
-- The existing exam_attempts / attempt_answers tables (which reference the
-- legacy validated_questions table) are left intact; the CBT engine will be
-- repointed onto this new model in M3. Both can coexist meanwhile.
--
-- Demo user until auth lands: 00000000-0000-0000-0000-000000000001
-- RLS is enabled on every new table but left PERMISSIVE for the demo user.
--   // TODO: tighten RLS with auth
-- ============================================================

-- ------------------------------------------------------------
-- exams — one row per exam; `config` jsonb IS the ExamConfig (§1/§2).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.exams (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug       text UNIQUE NOT NULL,
    name       text NOT NULL,
    config     jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- test_templates — PYP shift papers, subject tests, random-mock defs.
-- `template_key` gives every template a stable idempotent key so the seed
-- below can be re-run (e.g. after ingesting more papers) without duplicating.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.test_templates (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id      uuid NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
    mode         text NOT NULL CHECK (mode IN ('pyp', 'subject', 'random')),
    name         text NOT NULL,
    template_key text NOT NULL,
    meta         jsonb NOT NULL DEFAULT '{}'::jsonb,
    is_active    boolean NOT NULL DEFAULT true,
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_test_templates_exam_key UNIQUE (exam_id, template_key)
);

CREATE INDEX IF NOT EXISTS idx_test_templates_exam_mode
    ON public.test_templates (exam_id, mode) WHERE is_active;

-- ------------------------------------------------------------
-- test_sessions — a live/finished attempt. No FK to auth.users (demo user;
-- FK constraints to auth were dropped in migration 0017).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.test_sessions (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
    exam_id           uuid REFERENCES public.exams(id) ON DELETE SET NULL,
    template_id       uuid REFERENCES public.test_templates(id) ON DELETE SET NULL,
    mode              text NOT NULL CHECK (mode IN ('pyp', 'subject', 'random', 'custom')),
    status            text NOT NULL DEFAULT 'in_progress'
                          CHECK (status IN ('in_progress', 'submitted')),
    started_at        timestamptz NOT NULL DEFAULT now(),
    submitted_at      timestamptz,
    time_remaining_ms integer,
    snapshot          jsonb,
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_test_sessions_user_status
    ON public.test_sessions (user_id, status);
CREATE INDEX IF NOT EXISTS idx_test_sessions_created
    ON public.test_sessions (created_at DESC);

-- ------------------------------------------------------------
-- responses — per-question state. STRUCTURALLY COMPLETE now even though
-- confidence / is_correct / marks_awarded stay NULL until M3 (capture) and
-- M4 (scoring) fill them. question_id references the v2 canonical `questions`.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.responses (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id      uuid NOT NULL REFERENCES public.test_sessions(id) ON DELETE CASCADE,
    question_id     uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
    selected_option character(1) CHECK (selected_option IN ('A', 'B', 'C', 'D')),
    status          text NOT NULL DEFAULT 'not_visited'
                        CHECK (status IN ('not_visited', 'not_answered', 'answered',
                                          'marked', 'answered_marked')),
    confidence      text CHECK (confidence IN ('guessed', 'unsure', 'confident')),
    time_spent_ms   integer,
    visit_order     integer,
    is_correct      boolean,
    marks_awarded   numeric,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_responses_session_question UNIQUE (session_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_responses_session ON public.responses (session_id);
CREATE INDEX IF NOT EXISTS idx_responses_question ON public.responses (question_id);

-- ------------------------------------------------------------
-- session_results — deterministic scorer output (§5). One row per session.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.session_results (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id        uuid NOT NULL UNIQUE REFERENCES public.test_sessions(id) ON DELETE CASCADE,
    raw_score         numeric NOT NULL DEFAULT 0,
    net_score         numeric NOT NULL DEFAULT 0,
    correct           integer NOT NULL DEFAULT 0,
    wrong             integer NOT NULL DEFAULT 0,
    skipped           integer NOT NULL DEFAULT 0,
    attempted         integer NOT NULL DEFAULT 0,
    accuracy          numeric NOT NULL DEFAULT 0,
    section_breakdown jsonb,
    created_at        timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- mentor_reports — deterministic analysis JSON + optional LLM narrative (§6).
-- One row per session.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.mentor_reports (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id    uuid NOT NULL UNIQUE REFERENCES public.test_sessions(id) ON DELETE CASCADE,
    analysis      jsonb NOT NULL,
    optimal_score numeric,
    narrative_md  text,
    generated_at  timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- ROW LEVEL SECURITY — enabled but permissive for the demo user.
-- Server routes use the service-role key (bypasses RLS); these policies keep
-- the structure RLS-ready. // TODO: tighten RLS with auth
-- ============================================================
ALTER TABLE public.exams           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_templates  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_sessions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.responses       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mentor_reports  ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'exams', 'test_templates', 'test_sessions',
        'responses', 'session_results', 'mentor_reports'
    ] LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'demo_all_' || t, t);
        -- TODO: tighten RLS with auth — replace USING(true) with auth.uid() checks.
        EXECUTE format(
            'CREATE POLICY %I ON public.%I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)',
            'demo_all_' || t, t
        );
    END LOOP;
END $$;

-- ============================================================
-- SEED — SSC CGL Tier 1 exam config (§1). Must match
-- src/lib/exam/exam-config.ts (SSC_CGL_TIER1_CONFIG). Idempotent.
-- ============================================================
INSERT INTO public.exams (slug, name, config)
VALUES (
    'ssc-cgl-tier-1',
    'SSC CGL Tier 1',
    '{
      "schemaVersion": 1,
      "examSlug": "ssc-cgl-tier-1",
      "examName": "SSC CGL Tier 1",
      "tier": "Tier I",
      "totalDurationMinutes": 60,
      "hasSectionTimeLocks": false,
      "defaultLanguage": "en",
      "negativeMarking": true,
      "marksCorrect": 2,
      "marksWrong": -0.5,
      "sections": [
        {"key":"reasoning","name":"General Intelligence & Reasoning","order":1,"questionCount":25,"marksCorrect":2,"marksWrong":-0.5,"questionType":"single_correct_mcq","timeLimitMinutes":null},
        {"key":"general_awareness","name":"General Awareness","order":2,"questionCount":25,"marksCorrect":2,"marksWrong":-0.5,"questionType":"single_correct_mcq","timeLimitMinutes":null},
        {"key":"quantitative_aptitude","name":"Quantitative Aptitude","order":3,"questionCount":25,"marksCorrect":2,"marksWrong":-0.5,"questionType":"single_correct_mcq","timeLimitMinutes":null},
        {"key":"english_comprehension","name":"English Comprehension","order":4,"questionCount":25,"marksCorrect":2,"marksWrong":-0.5,"questionType":"single_correct_mcq","timeLimitMinutes":null}
      ]
    }'::jsonb
)
ON CONFLICT (slug) DO UPDATE
    SET name = EXCLUDED.name, config = EXCLUDED.config, updated_at = now();

-- ------------------------------------------------------------
-- SEED — subject templates (one per section). Stable config, not data-derived.
-- ------------------------------------------------------------
INSERT INTO public.test_templates (exam_id, mode, name, template_key, meta)
SELECT e.id, 'subject', s.name, 'subject:' || s.key,
       jsonb_build_object('section', s.key, 'questionCount', 25)
FROM (SELECT id FROM public.exams WHERE slug = 'ssc-cgl-tier-1') e
CROSS JOIN (
    VALUES
        ('reasoning',              'General Intelligence & Reasoning'),
        ('general_awareness',      'General Awareness'),
        ('quantitative_aptitude',  'Quantitative Aptitude'),
        ('english_comprehension',  'English Comprehension')
) AS s(key, name)
ON CONFLICT (exam_id, template_key) DO UPDATE
    SET name = EXCLUDED.name, meta = EXCLUDED.meta, updated_at = now();

-- ------------------------------------------------------------
-- SEED — random mock template (100 Q, 25 per section).
-- ------------------------------------------------------------
INSERT INTO public.test_templates (exam_id, mode, name, template_key, meta)
SELECT e.id, 'random', 'Random Mock (100 Q)', 'random:all',
       jsonb_build_object('perSection', 25, 'totalQuestions', 100)
FROM (SELECT id FROM public.exams WHERE slug = 'ssc-cgl-tier-1') e
ON CONFLICT (exam_id, template_key) DO UPDATE
    SET name = EXCLUDED.name, meta = EXCLUDED.meta, updated_at = now();

-- ------------------------------------------------------------
-- SEED — PYP templates, DATA-DRIVEN & HONEST (per M2 decision):
-- one template per paper that ACTUALLY HAS questions loaded. This naturally
-- EXCLUDES the 138 legacy stub papers (total_questions = 0, no questions),
-- without deleting them. Re-run this migration/seed after ingesting more
-- papers and PYP auto-populates with zero code changes.
-- ------------------------------------------------------------
INSERT INTO public.test_templates (exam_id, mode, name, template_key, meta)
SELECT
    e.id,
    'pyp',
    'SSC CGL ' || COALESCE(p.year::text, '') ||
        CASE WHEN p.shift IS NOT NULL AND btrim(p.shift) <> ''
             THEN ' — ' || p.shift ELSE '' END,
    'pyp:' || p.paper_id,
    jsonb_build_object(
        'paper_id', p.paper_id,
        'year', p.year,
        'shift', p.shift,
        'exam_date', p.exam_date,
        'questionCount', (SELECT count(*) FROM public.questions q WHERE q.paper_id = p.paper_id)
    )
FROM public.papers p
CROSS JOIN (SELECT id FROM public.exams WHERE slug = 'ssc-cgl-tier-1') e
WHERE EXISTS (SELECT 1 FROM public.questions q WHERE q.paper_id = p.paper_id)
ON CONFLICT (exam_id, template_key) DO UPDATE
    SET name = EXCLUDED.name, meta = EXCLUDED.meta, updated_at = now();

-- ============================================================
-- COMMENTS
-- ============================================================
COMMENT ON TABLE public.exams IS 'One row per exam; config jsonb is the ExamConfig (marking, duration, sections). Read by scorer/mentor — no marking constants in engine code.';
COMMENT ON TABLE public.test_templates IS 'Session blueprints: pyp (per loaded paper), subject (per section), random. PYP rows are data-driven from papers-with-questions.';
COMMENT ON TABLE public.test_sessions IS 'A CBT attempt (live or submitted). snapshot jsonb mirrors the Zustand store for crash recovery.';
COMMENT ON TABLE public.responses IS 'Per-question response incl. confidence (guessed|unsure|confident) — the AI Mentor''s key signal. is_correct/marks_awarded filled by the M4 scorer.';
COMMENT ON TABLE public.session_results IS 'Deterministic scorer output: raw/net score + section breakdown (§5).';
COMMENT ON TABLE public.mentor_reports IS 'Deterministic MentorAnalysis JSON + optional Claude narrative_md (§6).';
