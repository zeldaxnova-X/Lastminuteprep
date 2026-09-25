/**
 * Feature flags + funnel tuning constants (single source of truth).
 *
 * FREE_MOCK_FLOW gates the whole "anyone takes a full mock, headline free, full
 * report behind ₹9/₹49" funnel. It is SERVER-AUTHORITATIVE (read in the API
 * routes, never trusted from the client) and defaults ON in dev / OFF in prod so
 * it can be dark-shipped and flipped from the environment without a redeploy:
 *   FREE_MOCK_FLOW=on|off   (falls back to: on in dev, off in prod)
 */
export function freeMockFlowEnabled(): boolean {
  const raw = (process.env.FREE_MOCK_FLOW ?? "").trim().toLowerCase();
  if (raw === "on" || raw === "true" || raw === "1") return true;
  if (raw === "off" || raw === "false" || raw === "0") return false;
  return process.env.NODE_ENV !== "production";
}

/**
 * Abuse control for the signed-OUT full mock: at most this many COMPLETED
 * anonymous mocks per browser (device token) + IP per rolling 24h, then signup
 * is required. Deliberately modest — not an anti-fraud system, one config knob.
 */
export const ANON_MOCKS_PER_DAY = 1;

/**
 * The signed-IN free allowance: this many full mocks on the account (headline
 * report each) before All-Access (₹49) is required to start another. The full
 * per-attempt report is still a paid unlock (₹9) regardless of this count.
 * 3 also happens to be past MarksenseAI's ≥2-mock longitudinal threshold, so the
 * 2nd/3rd mock is the natural moment to promote the upgrade.
 */
export const FREE_ACCOUNT_MOCKS = 3;
