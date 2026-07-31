-- Migration: Drop user_id FK constraints on CBT tables for development
-- Auth will be added later; for now user_id is a plain UUID column.

-- exam_attempts
ALTER TABLE public.exam_attempts
  DROP CONSTRAINT IF EXISTS exam_attempts_user_id_fkey;

-- user_bookmarks
ALTER TABLE public.user_bookmarks
  DROP CONSTRAINT IF EXISTS user_bookmarks_user_id_fkey;

-- user_analytics
ALTER TABLE public.user_analytics
  DROP CONSTRAINT IF EXISTS user_analytics_user_id_fkey;

-- study_sessions
ALTER TABLE public.study_sessions
  DROP CONSTRAINT IF EXISTS study_sessions_user_id_fkey;

-- question_reports
ALTER TABLE public.question_reports
  DROP CONSTRAINT IF EXISTS question_reports_user_id_fkey;
