-- ============================================================================
-- Migration 20260814000000: razorpay_payments — payment ledger + idempotency.
--
-- The webhook (POST /api/razorpay/webhook) is the ONLY place a real payment
-- grants a plan. This table is its idempotency key (unique payment_id, so
-- Razorpay's retries/duplicate events never double-apply) AND the audit /
-- reconciliation record. `scope` is stored per-payment so the account-wide grant
-- today can flip to per-exam entitlements later without a checkout change.
--
-- RLS: users may read only their OWN payment rows; only the service role writes
-- (no INSERT/UPDATE policy => client writes are impossible).
-- ============================================================================
BEGIN;

CREATE TABLE IF NOT EXISTS public.razorpay_payments (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    razorpay_payment_id text UNIQUE NOT NULL,   -- idempotency key
    razorpay_order_id   text,
    user_id             uuid,
    plan                text,
    scope               text,                    -- e.g. 'ssc-cgl' (per-exam ready)
    amount              integer,                 -- paise
    currency            text,
    status              text NOT NULL DEFAULT 'processing',
    event_id            text,
    raw                 jsonb,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_razorpay_payments_user  ON public.razorpay_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_razorpay_payments_order ON public.razorpay_payments(razorpay_order_id);

ALTER TABLE public.razorpay_payments ENABLE ROW LEVEL SECURITY;

-- Own-row read only; writes are service-role only (RLS bypass), no write policy.
DROP POLICY IF EXISTS razorpay_payments_own_read ON public.razorpay_payments;
CREATE POLICY razorpay_payments_own_read ON public.razorpay_payments
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

COMMIT;
