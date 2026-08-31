/**
 * Score-gap coupon helpers. The discount is sized by the gap MarksenseAI found
 * between the user's actual and achievable marks on a free mock, so the framing
 * stays about decision quality, not about penalising a low raw score.
 */

export const COUPON_TTL_HOURS = 48;

/** Discount % for a given score gap (achievable minus actual marks). */
export function discountForGap(gap: number): number {
  if (gap >= 15) return 30;
  if (gap >= 8) return 20;
  return 10; // a smaller gap still earns a launch incentive
}

/** Short, human-legible coupon code. DB uniqueness is the real guard. */
export function makeCouponCode(): string {
  return "MS" + Math.random().toString(36).slice(2, 8).toUpperCase();
}

/** Apply a whole-percent discount to a paise amount, never below Razorpay's 100. */
export function applyDiscount(amountPaise: number, pct: number): number {
  const discounted = Math.round(amountPaise * (1 - pct / 100));
  return Math.max(100, discounted);
}
