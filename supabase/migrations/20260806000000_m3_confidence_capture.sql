-- ============================================================
-- Migration 20260806000000: M3 — confidence capture
-- Adds the per-answer confidence signal (§4) to the live engine table.
-- The canonical `responses` table (M2) already has this column; this brings
-- the in-flight attempt_answers store in line so confidence persists on every
-- Save and can be mirrored into responses at submit.
-- ADDITIVE ONLY.
-- ============================================================
ALTER TABLE public.attempt_answers
    ADD COLUMN IF NOT EXISTS confidence text
        CHECK (confidence IN ('guessed', 'unsure', 'confident'));

COMMENT ON COLUMN public.attempt_answers.confidence IS
    'Per-question confidence (guessed|unsure|confident) captured on Save — the AI Mentor''s key calibration signal. Defaults to unsure client-side.';
