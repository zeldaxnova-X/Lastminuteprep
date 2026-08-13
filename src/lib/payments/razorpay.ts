import Razorpay from "razorpay";

/**
 * Server-only Razorpay helpers. The KEY_SECRET lives here and NEVER reaches the
 * client. Amounts are decided server-side per plan — the browser never dictates
 * how much is charged (or which plan it buys).
 */

export type PaidPlan = "pro" | "mentor";

/** Founding prices, in paise. Mirrors the copy on the sample paywall. */
export const PLAN_PRICING: Record<PaidPlan, { amount: number; description: string }> = {
  pro: { amount: 1900, description: "LastMilePrep Pro — full report" },
  mentor: { amount: 4900, description: "LastMilePrep Mentor — report + AI engine" },
};

export const CURRENCY = "INR";

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
