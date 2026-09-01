import { NextResponse } from "next/server";
import { getSessionContext, json401, serviceClient } from "@/lib/auth/api-guard";
import { getViewer, canSeeMentor } from "@/lib/auth/plan";
import type { MentorAnalysis } from "@/lib/exam/mentor-analysis";

/**
 * GET /api/marksense/trends
 * Per-mock section-accuracy series for the MarksenseAI charts (progress across
 * sections over time). Reads each completed attempt's stored MentorAnalysis and
 * emits one point per mock with net score and per-section accuracy. Mentor-gated.
 */
export async function GET() {
  const { user } = await getSessionContext();
  if (!user) return json401();

  const viewer = await getViewer();
  if (!canSeeMentor(viewer.plan)) {
    return NextResponse.json({ locked: true }, { status: 200 });
  }

  const db = serviceClient();
  const { data: attempts } = await db
    .from("exam_attempts")
    .select("id, created_at")
    .eq("user_id", user.id)
    .in("status", ["completed", "auto_submitted"])
    .order("created_at", { ascending: true });

  if (!attempts || attempts.length === 0) {
    return NextResponse.json({ locked: false, sections: [], points: [] });
  }

  const ids = attempts.map((a) => a.id as string);
  const { data: reports } = await db
    .from("mentor_reports")
    .select("session_id, analysis")
    .in("session_id", ids);

  const byId = new Map<string, MentorAnalysis>();
  for (const r of reports ?? []) {
    if (r.analysis) byId.set(r.session_id as string, r.analysis as MentorAnalysis);
  }

  const sectionSet = new Set<string>();
  const points = attempts
    .filter((a) => byId.has(a.id as string))
    .map((a, i) => {
      const an = byId.get(a.id as string)!;
      const sections: Record<string, number> = {};
      for (const s of an.weakness.sections) {
        if (s.attempted > 0) {
          sections[s.name] = Math.round(s.accuracy * 1000) / 10;
          sectionSet.add(s.name);
        }
      }
      return {
        index: i + 1,
        date: a.created_at as string,
        net: an.score.netScore ?? 0,
        accuracyPct: Math.round((an.score.accuracy ?? 0) * 1000) / 10,
        sections,
      };
    });

  return NextResponse.json({
    locked: false,
    sections: [...sectionSet],
    points,
  });
}
