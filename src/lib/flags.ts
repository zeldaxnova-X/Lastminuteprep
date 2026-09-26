/**
 * Feature flags + funnel tuning constants (single source of truth).
 *
 * FREE_MOCK_FLOW gates the whole "anyone takes a full mock, headline free, full
 * report behind ₹9/₹49" funnel (incl. the SBI Clerk exam). It is SERVER-
 * AUTHORITATIVE (read in the API routes, never trusted from the client).
 *
 * LAUNCHED 2026-09-26: default ON everywhere. Kill-switch by setting the env var
 *   FREE_MOCK_FLOW=off   (env always overrides the default).
 */
export function freeMockFlowEnabled(): boolean {
  const raw = (process.env.FREE_MOCK_FLOW ?? "").trim().toLowerCase();
  if (raw === "on" || raw === "true" || raw === "1") return true;
  if (raw === "off" || raw === "false" || raw === "0") return false;
  return true; // launched
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
