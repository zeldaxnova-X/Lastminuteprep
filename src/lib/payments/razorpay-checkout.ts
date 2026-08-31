/**
 * Client-side Razorpay Standard Checkout helper. Loads checkout.js on demand,
 * creates an order via our backend, opens the modal, and verifies the result
 * server-side. The KEY_SECRET is never referenced here, only the public key id
 * returned by /api/razorpay/create-order.
 */

export type PaidPlan = "pro" | "mentor";

interface CheckoutHandlers {
  plan: PaidPlan;
  prefill?: { name?: string; email?: string };
  /**
   * Called once the payment succeeded and its checkout signature verified
   * server-side. The plan is NOT yet granted at this point, the webhook grants
   * it independently; callers should poll `waitForPlanUpgrade` to confirm.
   */
  onSuccess: (plan: string) => void;
  /** Called on any failure (order/verify error, payment.failed, script load). */
  onError: (message: string) => void;
  /** Called when the user closes the modal without paying. */
  onDismiss?: () => void;
}

const PLAN_RANK: Record<string, number> = { free: 0, pro: 1, mentor: 2 };

/**
 * Poll /api/auth/me until the account reaches (or exceeds) `target`, i.e. the
 * webhook has landed and granted the plan. Returns true on upgrade, false on
 * timeout (payment is still safe; the webhook will have applied it shortly).
 */
export async function waitForPlanUpgrade(
  target: PaidPlan,
  opts?: { timeoutMs?: number; intervalMs?: number }
): Promise<boolean> {
  const timeoutMs = opts?.timeoutMs ?? 20000;
  const intervalMs = opts?.intervalMs ?? 1500;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const r = await fetch("/api/auth/me", { cache: "no-store" });
      if (r.ok) {
        const v = (await r.json()) as { plan?: string };
        if ((PLAN_RANK[v.plan ?? "free"] ?? 0) >= PLAN_RANK[target]) return true;
      }
    } catch {
      // transient, keep polling
    }
    await new Promise((res) => setTimeout(res, intervalMs));
  }
  return false;
}

// Minimal shape of the global the checkout script installs.
interface RazorpayInstance {
  open: () => void;
  on: (event: string, cb: (resp: unknown) => void) => void;
}
interface RazorpayConstructor {
  new (options: Record<string, unknown>): RazorpayInstance;
}
declare global {
  interface Window {
    Razorpay?: RazorpayConstructor;
  }
}

const SCRIPT_SRC = "https://checkout.razorpay.com/v1/checkout.js";
let scriptPromise: Promise<boolean> | null = null;

function loadCheckoutScript(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<boolean>((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(true));
      existing.addEventListener("error", () => resolve(false));
      if (window.Razorpay) resolve(true);
      return;
    }
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => {
      scriptPromise = null; // allow a retry
      resolve(false);
    };
    document.body.appendChild(script);
  });
  return scriptPromise;
}

/** Full purchase flow for a plan. Resolves once the modal has been opened (or an
 *  error was reported); outcome is delivered via the handler callbacks. */
export async function startRazorpayCheckout(opts: CheckoutHandlers): Promise<void> {
  const loaded = await loadCheckoutScript();
  if (!loaded || !window.Razorpay) {
    opts.onError("Couldn't load the secure checkout. Check your connection and try again.");
    return;
  }

  // 1. Create the order on our backend (amount is decided there).
  let order: { order_id: string; amount: number; currency: string; key_id: string };
  try {
    const res = await fetch("/api/razorpay/create-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: opts.plan }),
    });
    if (res.status === 401) {
      opts.onError("Please sign in to continue.");
      return;
    }
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      opts.onError(j.error || "Couldn't start checkout. Please try again.");
      return;
    }
    order = await res.json();
  } catch {
    opts.onError("Couldn't reach the payment server. Please try again.");
    return;
  }

  // 2. Open the Razorpay modal for that order.
  const rzp = new window.Razorpay({
    key: order.key_id,
    order_id: order.order_id,
    amount: order.amount,
    currency: order.currency,
    name: "LastMilePrep",
    description: opts.plan === "mentor" ? "Mentor, report + AI engine" : "Pro, full report",
    prefill: opts.prefill,
    theme: { color: "#4f46e5" },
    // 3. On success, verify the signature server-side before trusting anything.
    handler: async (resp: unknown) => {
      const r = resp as {
        razorpay_order_id: string;
        razorpay_payment_id: string;
        razorpay_signature: string;
      };
      try {
        const v = await fetch("/api/razorpay/verify-payment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(r),
        });
        if (v.ok) {
          const j = (await v.json()) as { plan: string };
          opts.onSuccess(j.plan);
        } else {
          const j = (await v.json().catch(() => ({}))) as { error?: string };
          opts.onError(j.error || "We couldn't verify the payment. If you were charged, contact support.");
        }
      } catch {
        opts.onError("Payment made but verification didn't complete. Contact support if charged.");
      }
    },
    modal: { ondismiss: () => opts.onDismiss?.() },
  });

  rzp.on("payment.failed", (resp: unknown) => {
    const description = (resp as { error?: { description?: string } })?.error?.description;
    opts.onError(description || "Payment failed. No charge was made, please try again.");
  });

  rzp.open();
}
