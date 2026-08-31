-- ----------------------------------------------------------------------------
-- Paid-access expiry for the one-time-with-window billing model.
--
-- Payments are one-time Razorpay orders (no recurring mandate). Each purchase
-- grants a plan for a fixed window; `plan_expires_at` is when it lapses.
--   NULL  = no expiry (grandfathers every plan granted before this column, and
--           lets us hand out permanent comps without a sentinel date).
--   past  = treated as `free` by the paywall (see getViewer).
-- `plan_billing` records which duration was last bought (for display only).
-- ----------------------------------------------------------------------------
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS plan_expires_at timestamptz,
    ADD COLUMN IF NOT EXISTS plan_billing    text;

COMMENT ON COLUMN public.profiles.plan_expires_at IS 'When paid access lapses (one-time-with-window billing). NULL = never expires.';
COMMENT ON COLUMN public.profiles.plan_billing IS 'Duration of the last paid cycle: monthly | quarterly | halfyearly | annual.';
