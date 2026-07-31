-- ============================================================
-- Migration 20260730000007: CBT Exam Engine
-- LastMilePrep SSC CGL Platform
-- Dataset v1.2.1 is READ-ONLY. This migration is ADDITIVE ONLY.
-- ============================================================

-- ============================================================
-- TABLE 1: exam_attempts
-- Tracks every exam session lifecycle
-- ============================================================
CREATE TABLE IF NOT EXISTS public.exam_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Exam configuration
    exam_type TEXT NOT NULL CHECK (exam_type IN (
        'previous_year_paper', 'subject_test', 'random_test', 'custom_test'
    )),
    paper_id TEXT REFERENCES public.papers(paper_id),
    title TEXT NOT NULL,
    
    -- Filters used to generate this exam
    subject_filter TEXT,
    year_filter INTEGER,
    paper_type_filter TEXT,
    
    -- Exam parameters
    total_questions INTEGER NOT NULL,
    time_limit_seconds INTEGER NOT NULL DEFAULT 3600,
    marks_per_question NUMERIC NOT NULL DEFAULT 2.0,
    negative_marks_per_question NUMERIC NOT NULL DEFAULT 0.5,
    
    -- Status tracking
    status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN (
        'in_progress', 'completed', 'auto_submitted', 'abandoned'
    )),
    
    -- Scoring (populated on submit)
    total_answered INTEGER DEFAULT 0,
    total_correct INTEGER DEFAULT 0,
    total_wrong INTEGER DEFAULT 0,
    total_skipped INTEGER DEFAULT 0,
    total_marked_for_review INTEGER DEFAULT 0,
    score NUMERIC DEFAULT 0,
    max_score NUMERIC DEFAULT 0,
    percentage NUMERIC DEFAULT 0,
    
    -- Section-wise breakdown (JSON)
    section_breakdown JSONB,
    
    -- Time tracking
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    submitted_at TIMESTAMPTZ,
    time_spent_seconds INTEGER DEFAULT 0,
    
    -- Future ready
    difficulty_level TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- TABLE 2: attempt_answers
-- Per-question answer tracking with time spent
-- ============================================================
CREATE TABLE IF NOT EXISTS public.attempt_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attempt_id UUID NOT NULL REFERENCES public.exam_attempts(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES public.validated_questions(id) ON DELETE CASCADE,
    
    -- Answer state
    selected_option TEXT CHECK (selected_option IN ('A', 'B', 'C', 'D')),
    is_correct BOOLEAN,
    is_marked_for_review BOOLEAN NOT NULL DEFAULT false,
    is_visited BOOLEAN NOT NULL DEFAULT false,
    
    -- Scoring
    marks_awarded NUMERIC DEFAULT 0,
    
    -- Time tracking
    time_spent_seconds INTEGER DEFAULT 0,
    
    -- Ordering
    question_index INTEGER NOT NULL,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    CONSTRAINT unique_attempt_question UNIQUE (attempt_id, question_id)
);

-- ============================================================
-- TABLE 3: user_bookmarks
-- Bookmarked questions for revision
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_bookmarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES public.validated_questions(id) ON DELETE CASCADE,
    
    note TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    CONSTRAINT unique_user_bookmark UNIQUE (user_id, question_id)
);

-- ============================================================
-- TABLE 4: user_analytics
-- Aggregated per-subject performance metrics
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    
    -- Cumulative stats
    total_attempted INTEGER NOT NULL DEFAULT 0,
    total_correct INTEGER NOT NULL DEFAULT 0,
    total_wrong INTEGER NOT NULL DEFAULT 0,
    total_skipped INTEGER NOT NULL DEFAULT 0,
    
    -- Derived metrics
    accuracy NUMERIC NOT NULL DEFAULT 0,  -- (correct / attempted) * 100
    avg_time_per_question NUMERIC NOT NULL DEFAULT 0,  -- seconds
    total_time_spent_seconds INTEGER NOT NULL DEFAULT 0,
    
    -- Exam counts
    total_exams_taken INTEGER NOT NULL DEFAULT 0,
    
    -- Streak tracking
    best_streak INTEGER NOT NULL DEFAULT 0,
    current_streak INTEGER NOT NULL DEFAULT 0,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    CONSTRAINT unique_user_subject UNIQUE (user_id, subject)
);

-- ============================================================
-- TABLE 5: study_sessions
-- Session-level time tracking
-- ============================================================
CREATE TABLE IF NOT EXISTS public.study_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    session_type TEXT NOT NULL CHECK (session_type IN (
        'exam', 'revision', 'bookmark_review', 'wrong_answer_review'
    )),
    
    -- Optional references
    attempt_id UUID REFERENCES public.exam_attempts(id) ON DELETE SET NULL,
    subject TEXT,
    
    -- Time tracking
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at TIMESTAMPTZ,
    duration_seconds INTEGER DEFAULT 0,
    
    -- Activity metrics
    questions_reviewed INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- TABLE 6: question_reports
-- User-submitted reports for broken questions
-- ============================================================
CREATE TABLE IF NOT EXISTS public.question_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES public.validated_questions(id) ON DELETE CASCADE,
    
    report_type TEXT NOT NULL CHECK (report_type IN (
        'wrong_answer', 'wrong_question', 'wrong_options', 'wrong_explanation',
        'missing_image', 'formatting_issue', 'duplicate', 'other'
    )),
    description TEXT,
    
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending', 'reviewed', 'fixed', 'rejected'
    )),
    
    admin_notes TEXT,
    reviewed_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- PERFORMANCE INDEXES
-- ============================================================

-- exam_attempts
CREATE INDEX IF NOT EXISTS idx_exam_attempts_user_id ON public.exam_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_exam_attempts_status ON public.exam_attempts(status);
CREATE INDEX IF NOT EXISTS idx_exam_attempts_paper_id ON public.exam_attempts(paper_id);
CREATE INDEX IF NOT EXISTS idx_exam_attempts_user_status ON public.exam_attempts(user_id, status);
CREATE INDEX IF NOT EXISTS idx_exam_attempts_created ON public.exam_attempts(created_at DESC);

-- attempt_answers
CREATE INDEX IF NOT EXISTS idx_attempt_answers_attempt_id ON public.attempt_answers(attempt_id);
CREATE INDEX IF NOT EXISTS idx_attempt_answers_question_id ON public.attempt_answers(question_id);
CREATE INDEX IF NOT EXISTS idx_attempt_answers_is_correct ON public.attempt_answers(attempt_id, is_correct);

-- user_bookmarks
CREATE INDEX IF NOT EXISTS idx_user_bookmarks_user_id ON public.user_bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_user_bookmarks_question_id ON public.user_bookmarks(question_id);

-- user_analytics
CREATE INDEX IF NOT EXISTS idx_user_analytics_user_id ON public.user_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_user_analytics_user_subject ON public.user_analytics(user_id, subject);

-- study_sessions
CREATE INDEX IF NOT EXISTS idx_study_sessions_user_id ON public.study_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_study_sessions_attempt_id ON public.study_sessions(attempt_id);

-- question_reports
CREATE INDEX IF NOT EXISTS idx_question_reports_user_id ON public.question_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_question_reports_status ON public.question_reports(status);

-- Additive indexes on existing validated_questions (DO NOT ALTER TABLE)
ALTER TABLE public.validated_questions ADD COLUMN IF NOT EXISTS paper_id TEXT;
CREATE INDEX IF NOT EXISTS idx_vq_paper_id ON public.validated_questions(paper_id);
CREATE INDEX IF NOT EXISTS idx_vq_year ON public.validated_questions(year);
CREATE INDEX IF NOT EXISTS idx_vq_subject ON public.validated_questions(subject);
CREATE INDEX IF NOT EXISTS idx_vq_dataset_version ON public.validated_questions(dataset_version);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- Enable RLS on all new tables
ALTER TABLE public.exam_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attempt_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_reports ENABLE ROW LEVEL SECURITY;

-- Enable RLS on existing read-only tables
ALTER TABLE public.validated_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.papers ENABLE ROW LEVEL SECURITY;

-- validated_questions: public read for all authenticated users
DROP POLICY IF EXISTS "Allow authenticated read on validated_questions" ON public.validated_questions;
CREATE POLICY "Allow authenticated read on validated_questions"
    ON public.validated_questions FOR SELECT
    TO authenticated
    USING (true);

-- papers: public read for all authenticated users
DROP POLICY IF EXISTS "Allow authenticated read on papers" ON public.papers;
CREATE POLICY "Allow authenticated read on papers"
    ON public.papers FOR SELECT
    TO authenticated
    USING (true);

-- exam_attempts: users can only access their own
DROP POLICY IF EXISTS "Users can view own exam_attempts" ON public.exam_attempts;
CREATE POLICY "Users can view own exam_attempts"
    ON public.exam_attempts FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own exam_attempts" ON public.exam_attempts;
CREATE POLICY "Users can create own exam_attempts"
    ON public.exam_attempts FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own exam_attempts" ON public.exam_attempts;
CREATE POLICY "Users can update own exam_attempts"
    ON public.exam_attempts FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- attempt_answers: users access via their exam_attempts
DROP POLICY IF EXISTS "Users can view own attempt_answers" ON public.attempt_answers;
CREATE POLICY "Users can view own attempt_answers"
    ON public.attempt_answers FOR SELECT
    TO authenticated
    USING (
        attempt_id IN (
            SELECT id FROM public.exam_attempts WHERE user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can create own attempt_answers" ON public.attempt_answers;
CREATE POLICY "Users can create own attempt_answers"
    ON public.attempt_answers FOR INSERT
    TO authenticated
    WITH CHECK (
        attempt_id IN (
            SELECT id FROM public.exam_attempts WHERE user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can update own attempt_answers" ON public.attempt_answers;
CREATE POLICY "Users can update own attempt_answers"
    ON public.attempt_answers FOR UPDATE
    TO authenticated
    USING (
        attempt_id IN (
            SELECT id FROM public.exam_attempts WHERE user_id = auth.uid()
        )
    )
    WITH CHECK (
        attempt_id IN (
            SELECT id FROM public.exam_attempts WHERE user_id = auth.uid()
        )
    );

-- user_bookmarks: users own their bookmarks
DROP POLICY IF EXISTS "Users can view own bookmarks" ON public.user_bookmarks;
CREATE POLICY "Users can view own bookmarks"
    ON public.user_bookmarks FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create bookmarks" ON public.user_bookmarks;
CREATE POLICY "Users can create bookmarks"
    ON public.user_bookmarks FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own bookmarks" ON public.user_bookmarks;
CREATE POLICY "Users can delete own bookmarks"
    ON public.user_bookmarks FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- user_analytics: users own their analytics
DROP POLICY IF EXISTS "Users can view own analytics" ON public.user_analytics;
CREATE POLICY "Users can view own analytics"
    ON public.user_analytics FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own analytics" ON public.user_analytics;
CREATE POLICY "Users can insert own analytics"
    ON public.user_analytics FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own analytics" ON public.user_analytics;
CREATE POLICY "Users can update own analytics"
    ON public.user_analytics FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- study_sessions: users own their sessions
DROP POLICY IF EXISTS "Users can view own study_sessions" ON public.study_sessions;
CREATE POLICY "Users can view own study_sessions"
    ON public.study_sessions FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create study_sessions" ON public.study_sessions;
CREATE POLICY "Users can create study_sessions"
    ON public.study_sessions FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own study_sessions" ON public.study_sessions;
CREATE POLICY "Users can update own study_sessions"
    ON public.study_sessions FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- question_reports: users own their reports
DROP POLICY IF EXISTS "Users can view own reports" ON public.question_reports;
CREATE POLICY "Users can view own reports"
    ON public.question_reports FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create reports" ON public.question_reports;
CREATE POLICY "Users can create reports"
    ON public.question_reports FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- DATABASE FUNCTIONS
-- ============================================================

-- Function: Calculate score for an exam attempt
CREATE OR REPLACE FUNCTION public.calculate_exam_score(p_attempt_id UUID)
RETURNS TABLE (
    total_answered INTEGER,
    total_correct INTEGER,
    total_wrong INTEGER,
    total_skipped INTEGER,
    total_marked INTEGER,
    score NUMERIC,
    max_score NUMERIC,
    percentage NUMERIC,
    section_breakdown JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_marks_per_q NUMERIC;
    v_neg_marks NUMERIC;
    v_total_q INTEGER;
BEGIN
    -- Get exam config
    SELECT ea.marks_per_question, ea.negative_marks_per_question, ea.total_questions
    INTO v_marks_per_q, v_neg_marks, v_total_q
    FROM public.exam_attempts ea
    WHERE ea.id = p_attempt_id;

    -- Calculate totals
    SELECT
        COALESCE(COUNT(*) FILTER (WHERE aa.selected_option IS NOT NULL), 0)::INTEGER,
        COALESCE(COUNT(*) FILTER (WHERE aa.is_correct = true), 0)::INTEGER,
        COALESCE(COUNT(*) FILTER (WHERE aa.selected_option IS NOT NULL AND aa.is_correct = false), 0)::INTEGER,
        COALESCE(COUNT(*) FILTER (WHERE aa.selected_option IS NULL), 0)::INTEGER,
        COALESCE(COUNT(*) FILTER (WHERE aa.is_marked_for_review = true), 0)::INTEGER
    INTO total_answered, total_correct, total_wrong, total_skipped, total_marked
    FROM public.attempt_answers aa
    WHERE aa.attempt_id = p_attempt_id;

    -- Calculate score
    score := (total_correct * v_marks_per_q) - (total_wrong * v_neg_marks);
    max_score := v_total_q * v_marks_per_q;
    percentage := CASE WHEN max_score > 0 THEN ROUND((score / max_score) * 100, 2) ELSE 0 END;

    -- Section breakdown
    SELECT jsonb_agg(
        jsonb_build_object(
            'subject', sub.subject,
            'total', sub.total,
            'answered', sub.answered,
            'correct', sub.correct,
            'wrong', sub.wrong,
            'skipped', sub.skipped,
            'score', (sub.correct * v_marks_per_q) - (sub.wrong * v_neg_marks),
            'accuracy', CASE WHEN sub.answered > 0 THEN ROUND((sub.correct::NUMERIC / sub.answered) * 100, 2) ELSE 0 END
        )
    )
    INTO section_breakdown
    FROM (
        SELECT
            vq.subject,
            COUNT(*)::INTEGER AS total,
            COUNT(*) FILTER (WHERE aa.selected_option IS NOT NULL)::INTEGER AS answered,
            COUNT(*) FILTER (WHERE aa.is_correct = true)::INTEGER AS correct,
            COUNT(*) FILTER (WHERE aa.selected_option IS NOT NULL AND aa.is_correct = false)::INTEGER AS wrong,
            COUNT(*) FILTER (WHERE aa.selected_option IS NULL)::INTEGER AS skipped
        FROM public.attempt_answers aa
        JOIN public.validated_questions vq ON vq.id = aa.question_id
        WHERE aa.attempt_id = p_attempt_id
        GROUP BY vq.subject
        ORDER BY vq.subject
    ) sub;

    RETURN NEXT;
END;
$$;

-- Function: Submit exam and calculate final score
CREATE OR REPLACE FUNCTION public.submit_exam(
    p_attempt_id UUID,
    p_user_id UUID,
    p_auto_submit BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result RECORD;
    v_status TEXT;
    v_response JSONB;
BEGIN
    -- Verify ownership
    IF NOT EXISTS (
        SELECT 1 FROM public.exam_attempts
        WHERE id = p_attempt_id AND user_id = p_user_id AND status = 'in_progress'
    ) THEN
        RETURN jsonb_build_object('error', 'Exam not found or already submitted');
    END IF;

    -- Evaluate all answers
    UPDATE public.attempt_answers aa
    SET
        is_correct = (aa.selected_option = vq.correct_answer),
        marks_awarded = CASE
            WHEN aa.selected_option IS NULL THEN 0
            WHEN aa.selected_option = vq.correct_answer THEN (
                SELECT marks_per_question FROM public.exam_attempts WHERE id = p_attempt_id
            )
            ELSE -(SELECT negative_marks_per_question FROM public.exam_attempts WHERE id = p_attempt_id)
        END,
        updated_at = now()
    FROM public.validated_questions vq
    WHERE aa.question_id = vq.id
    AND aa.attempt_id = p_attempt_id;

    -- Calculate score
    SELECT * INTO v_result FROM public.calculate_exam_score(p_attempt_id);

    -- Determine status
    v_status := CASE WHEN p_auto_submit THEN 'auto_submitted' ELSE 'completed' END;

    -- Update exam attempt
    UPDATE public.exam_attempts SET
        status = v_status,
        total_answered = v_result.total_answered,
        total_correct = v_result.total_correct,
        total_wrong = v_result.total_wrong,
        total_skipped = v_result.total_skipped,
        total_marked_for_review = v_result.total_marked,
        score = v_result.score,
        max_score = v_result.max_score,
        percentage = v_result.percentage,
        section_breakdown = v_result.section_breakdown,
        submitted_at = now(),
        time_spent_seconds = EXTRACT(EPOCH FROM (now() - started_at))::INTEGER,
        updated_at = now()
    WHERE id = p_attempt_id;

    -- Build response
    v_response := jsonb_build_object(
        'attempt_id', p_attempt_id,
        'status', v_status,
        'total_answered', v_result.total_answered,
        'total_correct', v_result.total_correct,
        'total_wrong', v_result.total_wrong,
        'total_skipped', v_result.total_skipped,
        'score', v_result.score,
        'max_score', v_result.max_score,
        'percentage', v_result.percentage,
        'section_breakdown', v_result.section_breakdown
    );

    RETURN v_response;
END;
$$;

-- Function: Update user analytics after exam submission
CREATE OR REPLACE FUNCTION public.update_user_analytics(
    p_user_id UUID,
    p_attempt_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Upsert analytics per subject from this attempt's answers
    INSERT INTO public.user_analytics (user_id, subject, total_attempted, total_correct, total_wrong, total_skipped, accuracy, avg_time_per_question, total_time_spent_seconds, total_exams_taken)
    SELECT
        p_user_id,
        vq.subject,
        COUNT(*) FILTER (WHERE aa.selected_option IS NOT NULL),
        COUNT(*) FILTER (WHERE aa.is_correct = true),
        COUNT(*) FILTER (WHERE aa.selected_option IS NOT NULL AND aa.is_correct = false),
        COUNT(*) FILTER (WHERE aa.selected_option IS NULL),
        CASE WHEN COUNT(*) FILTER (WHERE aa.selected_option IS NOT NULL) > 0
            THEN ROUND((COUNT(*) FILTER (WHERE aa.is_correct = true)::NUMERIC / COUNT(*) FILTER (WHERE aa.selected_option IS NOT NULL)) * 100, 2)
            ELSE 0
        END,
        CASE WHEN COUNT(*) > 0
            THEN ROUND(COALESCE(SUM(aa.time_spent_seconds), 0)::NUMERIC / COUNT(*), 2)
            ELSE 0
        END,
        COALESCE(SUM(aa.time_spent_seconds), 0),
        1
    FROM public.attempt_answers aa
    JOIN public.validated_questions vq ON vq.id = aa.question_id
    WHERE aa.attempt_id = p_attempt_id
    GROUP BY vq.subject
    ON CONFLICT (user_id, subject) DO UPDATE SET
        total_attempted = public.user_analytics.total_attempted + EXCLUDED.total_attempted,
        total_correct = public.user_analytics.total_correct + EXCLUDED.total_correct,
        total_wrong = public.user_analytics.total_wrong + EXCLUDED.total_wrong,
        total_skipped = public.user_analytics.total_skipped + EXCLUDED.total_skipped,
        total_time_spent_seconds = public.user_analytics.total_time_spent_seconds + EXCLUDED.total_time_spent_seconds,
        total_exams_taken = public.user_analytics.total_exams_taken + 1,
        accuracy = CASE WHEN (public.user_analytics.total_attempted + EXCLUDED.total_attempted) > 0
            THEN ROUND(((public.user_analytics.total_correct + EXCLUDED.total_correct)::NUMERIC / (public.user_analytics.total_attempted + EXCLUDED.total_attempted)) * 100, 2)
            ELSE 0
        END,
        avg_time_per_question = CASE WHEN (public.user_analytics.total_attempted + EXCLUDED.total_attempted + public.user_analytics.total_skipped + EXCLUDED.total_skipped) > 0
            THEN ROUND((public.user_analytics.total_time_spent_seconds + EXCLUDED.total_time_spent_seconds)::NUMERIC / (public.user_analytics.total_attempted + EXCLUDED.total_attempted + public.user_analytics.total_skipped + EXCLUDED.total_skipped), 2)
            ELSE 0
        END,
        updated_at = now();
END;
$$;

-- Function: Toggle bookmark
CREATE OR REPLACE FUNCTION public.toggle_bookmark(
    p_user_id UUID,
    p_question_id UUID,
    p_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM public.user_bookmarks
        WHERE user_id = p_user_id AND question_id = p_question_id
    ) INTO v_exists;

    IF v_exists THEN
        DELETE FROM public.user_bookmarks
        WHERE user_id = p_user_id AND question_id = p_question_id;
        RETURN jsonb_build_object('action', 'removed', 'question_id', p_question_id);
    ELSE
        INSERT INTO public.user_bookmarks (user_id, question_id, note)
        VALUES (p_user_id, p_question_id, p_note);
        RETURN jsonb_build_object('action', 'added', 'question_id', p_question_id);
    END IF;
END;
$$;

-- ============================================================
-- COMMENTS
-- ============================================================
COMMENT ON TABLE public.exam_attempts IS 'Tracks every CBT exam session from start to submission with full scoring.';
COMMENT ON TABLE public.attempt_answers IS 'Per-question answer state with time tracking for each exam attempt.';
COMMENT ON TABLE public.user_bookmarks IS 'User-bookmarked questions for revision and study sessions.';
COMMENT ON TABLE public.user_analytics IS 'Aggregated per-subject performance metrics computed after each exam.';
COMMENT ON TABLE public.study_sessions IS 'Session-level time tracking for study analytics and activity reporting.';
COMMENT ON TABLE public.question_reports IS 'User-submitted reports for incorrect or broken questions.';

COMMENT ON FUNCTION public.calculate_exam_score IS 'Calculates score with section breakdown for a completed exam attempt.';
COMMENT ON FUNCTION public.submit_exam IS 'Evaluates answers, calculates score, and finalizes an exam attempt.';
COMMENT ON FUNCTION public.update_user_analytics IS 'Upserts user_analytics with cumulative performance data after exam submission.';
COMMENT ON FUNCTION public.toggle_bookmark IS 'Toggles bookmark state: adds if not exists, removes if exists.';
