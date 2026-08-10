import { NextResponse } from "next/server";
import { getViewer } from "@/lib/auth/plan";

/** GET /api/auth/me — the current viewer + plan, for the client nav/account menu. */
export async function GET() {
  const viewer = await getViewer();
  return NextResponse.json(viewer, {
    headers: { "Cache-Control": "no-store" },
  });
}
