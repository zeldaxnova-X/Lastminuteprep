import { NextResponse } from "next/server";
import { getViewer } from "@/lib/auth/plan";
import { claimSampleForUser } from "@/lib/auth/api-guard";

/**
 * GET /api/auth/me — the current viewer + plan, for the client nav/account menu.
 * Also the claim seam: when a signed-in user still carries an unclaimed sample
 * device cookie, attach that anonymous sample to their account (idempotent), so
 * the sample result follows them in regardless of signup method.
 */
export async function GET() {
  const viewer = await getViewer();
  if (viewer.authenticated && viewer.userId) {
    try {
      await claimSampleForUser(viewer.userId);
    } catch {
      // Claiming is best-effort; never block the viewer response on it.
    }
  }
  return NextResponse.json(viewer, {
    headers: { "Cache-Control": "no-store" },
  });
}
