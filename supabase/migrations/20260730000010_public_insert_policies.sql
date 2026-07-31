-- Migration: Grant Public Insert Policies for Seeding

DROP POLICY IF EXISTS "Allow insert on papers" ON public.papers;
CREATE POLICY "Allow insert on papers"
    ON public.papers FOR INSERT
    TO public
    WITH CHECK (true);

DROP POLICY IF EXISTS "Allow insert on validated_questions" ON public.validated_questions;
CREATE POLICY "Allow insert on validated_questions"
    ON public.validated_questions FOR INSERT
    TO public
    WITH CHECK (true);

DROP POLICY IF EXISTS "Allow insert on dataset_versions" ON public.dataset_versions;
CREATE POLICY "Allow insert on dataset_versions"
    ON public.dataset_versions FOR INSERT
    TO public
    WITH CHECK (true);
