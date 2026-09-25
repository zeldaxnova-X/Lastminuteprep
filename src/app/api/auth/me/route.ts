import { NextResponse } from "next/server";
import { getViewer } from "@/lib/auth/plan";
import { claimAnonymousAttempts } from "@/lib/auth/api-guard";
import { freeMockFlowEnabled } from "@/lib/flags";

/**
 * GET /api/auth/me, the current viewer + plan, for the client nav/account menu.
 * Also the claim seam: when a signed-in user still carries an unclaimed sample
 * device cookie, attach that anonymous sample to their account (idempotent), so
 * the sample result follows them in regardless of signup method.
 */
export async function GET() {
  const viewer = await getViewer();
  if (viewer.authenticated && viewer.userId) {
    try {
      await claimAnonymousAttempts(viewer.userId);
    } catch {
      // Claiming is best-effort; never block the viewer response on it.
    }
  }
  // Expose the server-authoritative funnel flag so the client can pick the right
  // CTA (full free mock vs legacy sample) without a second source of truth.
  return NextResponse.json(
    { ...viewer, freeMockFlow: freeMockFlowEnabled() },
    { headers: { "Cache-Control": "no-store" } }
  );
}
