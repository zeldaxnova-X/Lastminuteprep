-- Migration 20260730000006: Canonical Paper Registry & Metadata Normalization (Version 1.2.1)

CREATE TABLE IF NOT EXISTS public.papers (
    paper_id TEXT PRIMARY KEY,
    paper_name_original TEXT NOT NULL,
    paper_name_canonical TEXT UNIQUE NOT NULL,
    exam TEXT DEFAULT 'SSC CGL',
    year INTEGER NOT NULL,
    tier TEXT DEFAULT 'Tier I',
    paper_date TEXT,
    shift TEXT,
    paper_type TEXT CHECK (paper_type IN (
        'official_question_paper',
        'tcs_response_sheet',
        'official_answer_key',
        'solved_book',
        'similar_practice_paper',
        'candidate_summary',
        'incomplete_scan',
        'unsupported_document'
    )) NOT NULL,
    expected_questions INTEGER NOT NULL DEFAULT 100,
    validated_questions INTEGER NOT NULL DEFAULT 0,
    source_pdf TEXT UNIQUE NOT NULL,
    dataset_version TEXT DEFAULT '1.2.1',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.validated_questions
ADD COLUMN IF NOT EXISTS paper_id TEXT REFERENCES public.papers(paper_id);
