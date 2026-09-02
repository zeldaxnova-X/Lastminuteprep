-- Track which image-based questions have been rebuilt to the PYQ ingestion
-- standard (docs/pyq-ingestion-standard.md). NULL = not yet rebuilt.
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS rebuilt_at timestamptz;
COMMENT ON COLUMN public.questions.rebuilt_at IS 'When this question was rebuilt to the image-question standard; NULL = pending.';
