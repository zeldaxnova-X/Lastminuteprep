-- Migration 20260730000002: Versioning & Import Runs for Production 1.0

-- 1. Create dataset_versions table
CREATE TABLE IF NOT EXISTS public.dataset_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dataset_version VARCHAR(50) UNIQUE NOT NULL,
    dataset_name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    total_questions INTEGER NOT NULL DEFAULT 0,
    total_papers INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    notes TEXT
);

-- 2. Create import_runs table
CREATE TABLE IF NOT EXISTS public.import_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dataset_version VARCHAR(50) NOT NULL REFERENCES public.dataset_versions(dataset_version) ON DELETE CASCADE,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    papers_processed INTEGER NOT NULL DEFAULT 0,
    questions_imported INTEGER NOT NULL DEFAULT 0,
    validation_rate NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    status VARCHAR(50) NOT NULL DEFAULT 'COMPLETED',
    notes TEXT
);

-- 3. Add dataset_version column to validated_questions
ALTER TABLE public.validated_questions 
ADD COLUMN IF NOT EXISTS dataset_version VARCHAR(50) DEFAULT '1.0';

-- Indexes for fast version querying
CREATE INDEX IF NOT EXISTS idx_validated_questions_dataset_ver ON public.validated_questions(dataset_version);
CREATE INDEX IF NOT EXISTS idx_import_runs_version ON public.import_runs(dataset_version);
