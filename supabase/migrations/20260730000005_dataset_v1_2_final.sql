-- Migration 20260730000005: Dataset Version 1.2 Final Release & Permanent Pipeline Freeze

-- Register Dataset Version 1.2
INSERT INTO public.dataset_versions (
    id, dataset_version, dataset_name, created_at, total_questions, total_papers, status, notes
) VALUES (
    gen_random_uuid(), '1.2', 'SSC CGL Question Bank Version 1.2 (Final Recovery Release)', NOW(), 0, 0, 'ACTIVE', 'Production Version 1.2 Final Deterministic Ceiling Release'
) ON CONFLICT (dataset_version) DO NOTHING;

-- Log Import Run for Version 1.2
INSERT INTO public.import_runs (
    id, dataset_version, started_at, completed_at, papers_processed, questions_imported, validation_rate, status, notes
) VALUES (
    gen_random_uuid(), '1.2', NOW(), NOW(), 0, 0, 0.00, 'IN_PROGRESS', 'Running Final Recovery Pass v1.2'
) ON CONFLICT (id) DO NOTHING;
