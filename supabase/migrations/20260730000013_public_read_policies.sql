-- Migration: Grant Public Read Access to validated_questions and papers

DROP POLICY IF EXISTS "Allow authenticated read on validated_questions" ON public.validated_questions;
CREATE POLICY "Allow public read on validated_questions"
    ON public.validated_questions FOR SELECT
    TO anon, authenticated
    USING (true);

DROP POLICY IF EXISTS "Allow authenticated read on papers" ON public.papers;
CREATE POLICY "Allow public read on papers"
    ON public.papers FOR SELECT
    TO anon, authenticated
    USING (true);
