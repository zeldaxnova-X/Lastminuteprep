-- Migration: Allow public select on dataset_versions and insert dataset_versions rows directly
DROP POLICY IF EXISTS "Allow public select on dataset_versions" ON public.dataset_versions;
CREATE POLICY "Allow public select on dataset_versions"
    ON public.dataset_versions FOR SELECT
    TO anon, authenticated
    USING (true);

INSERT INTO public.dataset_versions (dataset_version, dataset_name, total_questions, total_papers, status)
VALUES
('1.0', 'Dataset Version 1.0 Initial Ingestion', 6133, 87, 'FROZEN'),
('1.1', 'Dataset Version 1.1 Recovery Pass', 10614, 138, 'FROZEN'),
('1.2', 'Dataset Version 1.2 Final Certified Freeze', 10614, 138, 'FROZEN'),
('1.2.1', 'Dataset Version 1.2.1 Normalized Production Dataset', 10614, 138, 'FROZEN')
ON CONFLICT (dataset_version) DO NOTHING;
