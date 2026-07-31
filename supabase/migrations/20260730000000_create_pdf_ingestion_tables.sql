-- Migration: Create PDF Ingestion Pipeline Staging and Production Tables for SSC CGL
-- Created: 2026-07-30

-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. STAGING TABLE: raw_questions
CREATE TABLE IF NOT EXISTS public.raw_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    paper_name TEXT NOT NULL,
    year INTEGER,
    shift TEXT,
    subject TEXT,
    question_number INTEGER,
    question_text TEXT,
    question_image TEXT,
    option_a TEXT,
    option_b TEXT,
    option_c TEXT,
    option_d TEXT,
    correct_answer TEXT,
    official_explanation TEXT,
    marks NUMERIC DEFAULT 2.0,
    negative_marks NUMERIC DEFAULT 0.5,
    source_pdf TEXT NOT NULL,
    extraction_status TEXT DEFAULT 'raw',
    validation_errors JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. PRODUCTION TABLE: validated_questions
CREATE TABLE IF NOT EXISTS public.validated_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    paper_name TEXT NOT NULL,
    year INTEGER NOT NULL,
    shift TEXT NOT NULL,
    subject TEXT NOT NULL,
    question_number INTEGER NOT NULL,
    question_text TEXT NOT NULL,
    question_image TEXT,
    option_a TEXT,
    option_b TEXT,
    option_c TEXT,
    option_d TEXT,
    correct_answer TEXT NOT NULL,
    official_explanation TEXT,
    marks NUMERIC DEFAULT 2.0,
    negative_marks NUMERIC DEFAULT 0.5,
    source_pdf TEXT NOT NULL,
    is_validated BOOLEAN DEFAULT true,
    validated_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT unique_validated_paper_qnum UNIQUE (paper_name, question_number)
);

-- 3. AUDIT LOG TABLE: pdf_ingestion_logs
CREATE TABLE IF NOT EXISTS public.pdf_ingestion_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pdf_filename TEXT NOT NULL UNIQUE,
    pdf_type TEXT NOT NULL, -- 'question_paper', 'answer_key', 'solution'
    paper_name TEXT,
    year INTEGER,
    shift TEXT,
    total_questions_extracted INTEGER DEFAULT 0,
    total_questions_validated INTEGER DEFAULT 0,
    total_questions_flagged INTEGER DEFAULT 0,
    status TEXT DEFAULT 'completed', -- 'completed', 'failed', 'partial'
    error_message TEXT,
    ingested_at TIMESTAMPTZ DEFAULT now()
);

-- 4. MANUAL REVIEW QUEUE TABLE: manual_review_queue
CREATE TABLE IF NOT EXISTS public.manual_review_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    raw_question_id UUID REFERENCES public.raw_questions(id) ON DELETE CASCADE,
    paper_name TEXT NOT NULL,
    question_number INTEGER,
    source_pdf TEXT NOT NULL,
    review_reason TEXT NOT NULL,
    details JSONB,
    is_resolved BOOLEAN DEFAULT false,
    resolved_by TEXT,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- INDEXES FOR MAXIMUM QUERY PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_raw_questions_paper ON public.raw_questions(paper_name);
CREATE INDEX IF NOT EXISTS idx_raw_questions_source_pdf ON public.raw_questions(source_pdf);
CREATE INDEX IF NOT EXISTS idx_validated_questions_paper ON public.validated_questions(paper_name);
CREATE INDEX IF NOT EXISTS idx_validated_questions_year_shift ON public.validated_questions(year, shift);
CREATE INDEX IF NOT EXISTS idx_validated_questions_subject ON public.validated_questions(subject);
CREATE INDEX IF NOT EXISTS idx_validated_questions_source ON public.validated_questions(source_pdf);
CREATE INDEX IF NOT EXISTS idx_manual_review_resolved ON public.manual_review_queue(is_resolved);

-- COMMENTS
COMMENT ON TABLE public.raw_questions IS 'Staging table for raw extracted questions from SSC CGL PDFs before validation.';
COMMENT ON TABLE public.validated_questions IS 'Production table for clean, verified, non-hallucinated SSC CGL questions.';
COMMENT ON TABLE public.pdf_ingestion_logs IS 'Audit logging table tracking PDF processing status and extraction counts.';
COMMENT ON TABLE public.manual_review_queue IS 'Queue of questions requiring human review due to missing options, answers, or parsing errors.';
