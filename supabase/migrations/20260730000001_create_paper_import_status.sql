-- Migration: Create paper_import_status tracking table for SSC CGL Ingestion Pipeline
-- Created: 2026-07-30

CREATE TABLE IF NOT EXISTS public.paper_import_status (
    paper_name TEXT PRIMARY KEY,
    year INTEGER NOT NULL,
    shift TEXT NOT NULL,
    expected_questions INTEGER DEFAULT 100,
    raw_records INTEGER DEFAULT 0,
    validated_questions INTEGER DEFAULT 0,
    manual_review INTEGER DEFAULT 0,
    duplicates INTEGER DEFAULT 0,
    missing_answers INTEGER DEFAULT 0,
    missing_options INTEGER DEFAULT 0,
    status TEXT DEFAULT 'PENDING', -- 'SUCCESS', 'NEEDS_REVIEW', 'FAILED'
    validation_percentage NUMERIC DEFAULT 0.0,
    last_imported_at TIMESTAMPTZ DEFAULT now()
);

-- Index for quick lookup
CREATE INDEX IF NOT EXISTS idx_paper_import_status_year ON public.paper_import_status(year);
CREATE INDEX IF NOT EXISTS idx_paper_import_status_status ON public.paper_import_status(status);

COMMENT ON TABLE public.paper_import_status IS 'Tracks quality metrics, expected vs validated questions, and import status for every SSC CGL paper.';
