-- ----------------------------------------------------------------------------
-- Score-gap discount coupons.
--
-- After a free mock, MarksenseAI computes the gap (achievable - actual marks).
-- We mint a single-use coupon tied to the account, sized by that gap, with a
-- short expiry for urgency. Applied server-side at create-order; marked used by
-- the webhook on a successful, granted payment.
--
-- One active coupon per user: regeneration replaces the prior UNUSED one.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.coupons (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    code         text NOT NULL UNIQUE,
    discount_pct integer NOT NULL CHECK (discount_pct BETWEEN 1 AND 90),
    gap_marks    numeric,
    source       text NOT NULL DEFAULT 'score_gap',
    expires_at   timestamptz NOT NULL,
    used_at      timestamptz,
    created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coupons_user ON public.coupons(user_id);
CREATE INDEX IF NOT EXISTS idx_coupons_active ON public.coupons(user_id, used_at, expires_at);

ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

-- Owners may read their own coupons (for the offer UI). Writes happen only via
-- the service role (offer generation + webhook), never from the client.
DROP POLICY IF EXISTS "read own coupons" ON public.coupons;
CREATE POLICY "read own coupons" ON public.coupons
    FOR SELECT USING (auth.uid() = user_id);
