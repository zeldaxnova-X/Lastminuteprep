import Razorpay from "razorpay";

/**
 * Server-only Razorpay helpers. The KEY_SECRET lives here and NEVER reaches the
 * client. Amounts are decided server-side per plan, the browser never dictates
 * how much is charged (or which plan it buys).
 */

export type PaidPlan = "pro" | "mentor";
export type Billing = "monthly" | "quarterly" | "halfyearly" | "annual";

/** One purchasable line: launch price in paise + the access window it grants. */
export interface PriceEntry {
  amount: number;
  days: number;
  description: string;
}

/**
 * Launch prices in paise, keyed by plan then billing period. Pro is monthly
 * only; MarksenseAI (internally `mentor`) has four durations. `days` is the
 * one-time access window each payment grants (see plan_expires_at). Amounts
 * mirror the pricing UI; the browser never sends an amount.
 */
export const PLAN_PRICING: Record<PaidPlan, Partial<Record<Billing, PriceEntry>>> = {
  pro: {
    monthly: { amount: 1900, days: 30, description: "LastMilePrep Pro, unlimited exams + full report" },
  },
  mentor: {
    monthly: { amount: 9900, days: 30, description: "MarksenseAI, monthly" },
    quarterly: { amount: 24900, days: 90, description: "MarksenseAI, quarterly" },
    halfyearly: { amount: 39900, days: 180, description: "MarksenseAI, half-yearly" },
    annual: { amount: 59900, days: 365, description: "MarksenseAI, annual" },
  },
};

/** Resolve a (plan, billing) pair to its price entry, or null if not offered. */
export function resolvePrice(plan: PaidPlan, billing: Billing): PriceEntry | null {
  return PLAN_PRICING[plan]?.[billing] ?? null;
}

export function isBilling(v: unknown): v is Billing {
  return v === "monthly" || v === "quarterly" || v === "halfyearly" || v === "annual";
}

export const CURRENCY = "INR";

/**
 * Entitlement scope stamped on every order + ledger row. Account-wide today
 * (only SSC CGL is live), but recorded per-payment so the webhook can flip to
 * per-exam `entitlements[scope]` later without any checkout change.
 */
export const EXAM_SCOPE = "ssc-cgl";

export function isPaidPlan(v: unknown): v is PaidPlan {
  return v === "pro" || v === "mentor";
}

let client: Razorpay | null = null;

/** Lazily-built Razorpay client. Throws if keys aren't configured (env only). */
export function razorpay(): Razorpay {
  if (!client) {
    const key_id = process.env.RAZORPAY_KEY_ID;
    const key_secret = process.env.RAZORPAY_KEY_SECRET;
    if (!key_id || !key_secret) {
      throw new Error("Razorpay keys are not configured (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET).");
    }
    client = new Razorpay({ key_id, key_secret });
  }
  return client;
}
