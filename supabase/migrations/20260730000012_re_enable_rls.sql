-- Migration: Re-enable Row Level Security & Clean Up Temporary Seed Policies

ALTER TABLE public.papers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.validated_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dataset_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow insert on papers" ON public.papers;
DROP POLICY IF EXISTS "Allow insert on validated_questions" ON public.validated_questions;
DROP POLICY IF EXISTS "Allow insert on dataset_versions" ON public.dataset_versions;
