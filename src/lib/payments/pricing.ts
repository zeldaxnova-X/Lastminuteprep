/**
 * Single source of truth for the ALL-ACCESS pass price + launch offer.
 *
 * Pure constants/helpers only (NO Razorpay SDK import) so this module is safe to
 * import from both client components (landing, dashboard, sample) and server
 * routes (create-order). The server decides the amount charged; the client only
 * uses these for display.
 *
 * Product model (from founder, 2026-09-18 / clarified 2026-09-20): there is ONE
 * paid product — All-Access, unlocking every exam AND MarksenseAI. ₹99/month is
 * the regular ("starting") charge. As an early-launch deal, ₹49 buys a ONE-TIME
 * pass valid THROUGH the launch end date (31 Oct 2026) — not a recurring charge,
 * and not a fixed 365-day window: whenever you buy during launch, access runs to
 * 31 Oct 2026. After the launch ends, All-Access becomes ₹99/month. (Recurring
 * monthly billing itself is a later build; founder will review pricing then. For
 * now, post-launch purchases grant a 30-day one-time-with-expiry window at ₹99.)
 * Internally the pass grants the `mentor` plan (highest rank) → everything on.
 */

/** Launch (early-access) one-time price of the All-Access pass, in whole rupees. */
export const ALL_ACCESS_LAUNCH_PRICE_INR = 49;

/** Regular monthly price after the launch ends, in whole rupees. */
export const ALL_ACCESS_REGULAR_PRICE_INR = 99;

/**
 * The launch offer ends at this instant (IST). During launch, ₹49 grants access
 * THROUGH this date; on/after it the price is the regular ₹99/month — flips by
 * date, no redeploy needed. 31 Oct 2026, 23:59:59 +05:30.
 */
export const ALL_ACCESS_OFFER_END = new Date("2026-10-31T23:59:59+05:30");

/** Human-readable end date for launch-offer copy. */
export const ALL_ACCESS_OFFER_END_LABEL = "31 October 2026";

/** Post-launch monthly window (days), until real recurring billing is built. */
export const ALL_ACCESS_MONTHLY_DAYS = 30;

/** True while the launch price is in effect. */
export function isLaunchOffer(now: Date = new Date()): boolean {
  return now.getTime() <= ALL_ACCESS_OFFER_END.getTime();
}

/** The price to show/charge right now, in whole rupees (₹49 launch, else ₹99). */
export function allAccessPriceInr(now: Date = new Date()): number {
  return isLaunchOffer(now) ? ALL_ACCESS_LAUNCH_PRICE_INR : ALL_ACCESS_REGULAR_PRICE_INR;
}

/** The current price in paise, for Razorpay order creation. */
export function allAccessAmountPaise(now: Date = new Date()): number {
  return allAccessPriceInr(now) * 100;
}

/**
 * Access window (days) one purchase grants. During launch: enough days that the
 * expiry lands on the launch end date (so a ₹49 pass bought any time in launch
 * runs THROUGH 31 Oct 2026). After launch: a 30-day monthly window at ₹99.
 */
export function allAccessAccessDays(now: Date = new Date()): number {
  if (!isLaunchOffer(now)) return ALL_ACCESS_MONTHLY_DAYS;
  const ms = ALL_ACCESS_OFFER_END.getTime() - now.getTime();
  return Math.max(1, Math.ceil(ms / 86_400_000));
}

/** True once All-Access is sold as a recurring monthly charge (post-launch). */
export function isMonthlyBilling(now: Date = new Date()): boolean {
  return !isLaunchOffer(now);
}

/** Order/ledger description stamped on every All-Access purchase. */
export const ALL_ACCESS_DESCRIPTION = "LastMilePrep All-Access — every exam + MarksenseAI";
