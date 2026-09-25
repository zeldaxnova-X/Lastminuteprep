import { NextRequest, NextResponse } from "next/server";
import { getViewer } from "@/lib/auth/plan";
import { readDeviceToken } from "@/lib/auth/api-guard";
import { emitEvent, type FunnelEvent } from "@/lib/analytics/events";

/**
 * POST /api/events — client-side funnel events. The anon/auth state and user id
 * are stamped SERVER-SIDE (never trusted from the body). Only a safe subset of
 * events may be emitted from the client; the outcome events (unlock/upgrade
 * completed, mock started/completed) are emitted server-side elsewhere.
 */
const CLIENT_EVENTS = new Set<FunnelEvent>([
  "signup_started",
  "signup_completed",
  "upgrade_cta_viewed",
  "upgrade_started",
  "report_teaser_viewed",
]);

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    event?: string;
    examCode?: string;
    props?: Record<string, unknown>;
  };
  const event = body.event as FunnelEvent | undefined;
  if (!event || !CLIENT_EVENTS.has(event)) {
    return NextResponse.json({ ok: false, error: "unknown event" }, { status: 400 });
  }

  const viewer = await getViewer();
  const deviceToken = viewer.authenticated ? null : await readDeviceToken();

  await emitEvent(event, {
    examCode: body.examCode ?? "ssc-cgl",
    anonymous: !viewer.authenticated,
    userId: viewer.userId,
    deviceToken,
    props: body.props ?? {},
  });
  return NextResponse.json({ ok: true });
}
