-- ============================================================================
-- Migration 20260925000000: Free-mock funnel
--
-- Enables the "anyone takes a full mock, headline free, full report behind
-- ₹9 (per attempt) / ₹49 (All-Access)" funnel. ADDITIVE + REVERSIBLE — no
-- destructive column drops. Rollback: supabase/manual/rollback_20260925000000.sql
--
-- Pieces:
--   1. test_sessions.user_id nullable + device_id  → anonymous reports can build
--      (the canonical mirror previously failed for signed-out attempts because
--      user_id was NOT NULL).
--   2. report_unlocks                              → the ₹9 per-attempt entitlement
--   3. analytics_events                            → funnel instrumentation
--   4. anon_mock_ledger                            → 24h anonymous-mock cap
--   5. claim_anonymous_attempts(user, device)      → ATOMIC claim-on-signup RPC
-- ============================================================================
BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Anonymous support on the canonical mirror. exam_attempts already allows
--    NULL user_id + device_id (20260810000000); mirror test_sessions to match so
--    submit's mirrorToCanonical + buildAndStoreReport succeed for signed-out
--    attempts (otherwise a signed-out mock never gets a scored report).
-- ----------------------------------------------------------------------------
ALTER TABLE public.test_sessions ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.test_sessions ADD COLUMN IF NOT EXISTS device_id text;
CREATE INDEX IF NOT EXISTS idx_test_sessions_device ON public.test_sessions(device_id);

-- ----------------------------------------------------------------------------
-- 2. report_unlocks — one row per (attempt) a user has paid ₹9 to fully unlock.
--    Distinct from a plan grant: it entitles ONLY that attempt's full report.
--    Service-role only (no client policies); the report gate reads it server-side.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.report_unlocks (
    attempt_id           uuid PRIMARY KEY REFERENCES public.exam_attempts(id) ON DELETE CASCADE,
    user_id              uuid NOT NULL,
    razorpay_payment_id  text,
    unlocked_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_report_unlocks_user ON public.report_unlocks(user_id);
ALTER TABLE public.report_unlocks ENABLE ROW LEVEL SECURITY;
-- (intentionally NO policies — service-role only, mirrors sample_attempts)

-- ----------------------------------------------------------------------------
-- 3. analytics_events — minimal funnel telemetry (no third-party analytics wired).
--    Service-role only.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.analytics_events (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event         text NOT NULL,
    exam_code     text,
    is_anonymous  boolean NOT NULL DEFAULT false,
    user_id       uuid,
    device_token  text,
    props         jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_analytics_events_event_time ON public.analytics_events(event, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user ON public.analytics_events(user_id);
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
-- (intentionally NO policies — service-role only)

-- ----------------------------------------------------------------------------
-- 4. anon_mock_ledger — one row per COMPLETED anonymous mock, for the 24h cap
--    keyed on device token + IP. Service-role only.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.anon_mock_ledger (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    device_token  text,
    ip            text,
    attempt_id    uuid REFERENCES public.exam_attempts(id) ON DELETE SET NULL,
    created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_anon_mock_ledger_device_time ON public.anon_mock_ledger(device_token, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_anon_mock_ledger_ip_time ON public.anon_mock_ledger(ip, created_at DESC);
ALTER TABLE public.anon_mock_ledger ENABLE ROW LEVEL SECURITY;
-- (intentionally NO policies — service-role only)

-- ----------------------------------------------------------------------------
-- 5. claim_anonymous_attempts — ATOMIC claim-on-signup. Reassigns EVERY
--    device-owned anonymous attempt (exam_attempts + its canonical test_sessions
--    mirror) to the signing-up user in one transaction, clears device_id, and
--    stamps the sample_attempts ledger. SECURITY DEFINER so it can write the
--    service-only ledger; guarded by an explicit p_user/p_device match.
--    Idempotent: a second call finds nothing left to claim.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_anonymous_attempts(p_user uuid, p_device text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_claimed integer := 0;
BEGIN
    IF p_user IS NULL OR p_device IS NULL OR btrim(p_device) = '' THEN
        RETURN 0;
    END IF;

    -- Reassign the attempts themselves.
    UPDATE public.exam_attempts
       SET user_id = p_user, device_id = NULL, updated_at = now()
     WHERE device_id = p_device AND user_id IS NULL;
    GET DIAGNOSTICS v_claimed = ROW_COUNT;

    -- Reassign their canonical mirror rows (best-effort; keyed by same id).
    UPDATE public.test_sessions
       SET user_id = p_user, device_id = NULL, updated_at = now()
     WHERE device_id = p_device AND user_id IS NULL;

    -- Stamp the sample ledger so the legacy claim path is a no-op afterwards.
    UPDATE public.sample_attempts
       SET claimed_by = p_user, claimed_at = now()
     WHERE device_token = p_device AND claimed_by IS NULL;

    RETURN v_claimed;
END;
$$;

COMMENT ON FUNCTION public.claim_anonymous_attempts IS
    'Atomically reassign all device-owned anonymous attempts (+ canonical mirror) to a user on signup. Idempotent.';

COMMIT;
