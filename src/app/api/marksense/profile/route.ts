import { NextResponse } from "next/server";
import { getSessionContext, json401, serviceClient } from "@/lib/auth/api-guard";
import { getViewer, canSeeMentor } from "@/lib/auth/plan";
import { buildLearnerProfile, MIN_TESTS_FOR_PROFILE } from "@/lib/ai/build-learner-profile";
import { buildActionPlan } from "@/lib/ai/action-plan";
import { aiEnabled } from "@/lib/ai/deepseek";
import { getExamEntry } from "@/lib/exam/registry";

/** Validated exam_code from ?exam= (defaults to SSC CGL). */
function examParam(request: Request): string {
  return getExamEntry(new URL(request.url).searchParams.get("exam")).code;
}

/**
 * GET /api/marksense/profile
 * The signed-in user's longitudinal MarksenseAI profile. Builds it on demand if
 * missing or stale (cheap when the signals are unchanged, since the AI call is
 * skipped). Mentor-plan gated: this is the paid, cross-attempt intelligence.
 */
export async function GET(request: Request) {
  const { user } = await getSessionContext();
  if (!user) return json401();

  const viewer = await getViewer();
  if (!canSeeMentor(viewer.plan)) {
    return NextResponse.json(
      { locked: true, plan: viewer.plan, aiAvailable: aiEnabled() },
      { status: 200 }
    );
  }

  const examCode = examParam(request);
  // Service role: reads any attempt's stored analysis + writes learner_profiles
  // (RLS blocks client writes). Identity is already proven above.
  const db = serviceClient();
  const built = await buildLearnerProfile(db, user.id, examCode, false);

  if (!built.ok || !built.row) {
    return NextResponse.json({
      locked: false,
      hasProfile: false,
      reason: built.reason ?? "not_ready",
      attemptsAnalyzed: built.attemptsAnalyzed ?? 0,
      minTests: MIN_TESTS_FOR_PROFILE,
      aiAvailable: aiEnabled(),
    });
  }

  return NextResponse.json({
    locked: false,
    hasProfile: true,
    regenerated: built.regenerated,
    aiAvailable: built.row.aiAvailable,
    attemptsAnalyzed: built.row.attemptsAnalyzed,
    minTests: MIN_TESTS_FOR_PROFILE,
    generatedAt: built.row.generatedAt,
    signals: built.row.signals,
    profile: built.row.profile,
    taskList: built.row.signals ? buildActionPlan(built.row.signals, examCode) : [],
  });
}

/**
 * POST /api/marksense/profile
 * Force a fresh AI regeneration (the "refresh my profile" button).
 */
export async function POST(request: Request) {
  const { user } = await getSessionContext();
  if (!user) return json401();

  const viewer = await getViewer();
  if (!canSeeMentor(viewer.plan)) {
    return NextResponse.json({ locked: true, plan: viewer.plan }, { status: 200 });
  }

  const examCode = examParam(request);
  const db = serviceClient();
  const built = await buildLearnerProfile(db, user.id, examCode, true);

  if (!built.ok || !built.row) {
    return NextResponse.json(
      {
        error: built.reason ?? "Could not build profile",
        reason: built.reason,
        attemptsAnalyzed: built.attemptsAnalyzed ?? 0,
        minTests: MIN_TESTS_FOR_PROFILE,
      },
      { status: 404 }
    );
  }

  return NextResponse.json({
    hasProfile: true,
    regenerated: built.regenerated,
    aiAvailable: built.row.aiAvailable,
    attemptsAnalyzed: built.row.attemptsAnalyzed,
    minTests: MIN_TESTS_FOR_PROFILE,
    generatedAt: built.row.generatedAt,
    signals: built.row.signals,
    profile: built.row.profile,
    taskList: built.row.signals ? buildActionPlan(built.row.signals, examCode) : [],
  });
}
