-- Migration 20260730000003: Add Subject Classification Fields for Dataset Version 1.1

ALTER TABLE public.validated_questions
ADD COLUMN IF NOT EXISTS predicted_subject TEXT,
ADD COLUMN IF NOT EXISTS classification_confidence NUMERIC(4,2),
ADD COLUMN IF NOT EXISTS classification_method TEXT;

-- Create subject_review_queue table for ambiguous subject classifications
CREATE TABLE IF NOT EXISTS public.subject_review_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID REFERENCES public.validated_questions(id) ON DELETE CASCADE,
    paper_name TEXT NOT NULL,
    question_number INTEGER,
    original_subject TEXT,
    predicted_subject TEXT,
    confidence NUMERIC,
    matched_rules TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);
