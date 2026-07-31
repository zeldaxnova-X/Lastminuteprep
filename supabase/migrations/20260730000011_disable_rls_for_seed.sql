-- Temporary Migration: Disable RLS for Seeding
ALTER TABLE public.papers DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.validated_questions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.dataset_versions DISABLE ROW LEVEL SECURITY;
