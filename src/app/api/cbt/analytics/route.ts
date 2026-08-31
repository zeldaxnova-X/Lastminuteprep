import { NextResponse } from "next/server";
import { getSessionContext, json401 } from "@/lib/auth/api-guard";

/**
 * GET /api/cbt/analytics
 * Get the signed-in user's performance analytics from their own attempts.
 * Identity is server-derived; the user-scoped client means RLS also restricts
 * rows to auth.uid() as a backstop.
 */
export async function GET() {
  try {
    const { user, supabase } = await getSessionContext();
    if (!user) return json401();
    const userId = user.id;

    // Fetch all completed attempts for this user.
    // NOTE: the column is `score` (not `total_score`), selecting a non-existent
    // column previously 500'd this endpoint and broke the dashboard.
    const { data: attempts, error } = await supabase
      .from("exam_attempts")
      .select("id, score, max_score, total_questions, time_spent_seconds, created_at, section_breakdown")
      .eq("user_id", userId)
      .in("status", ["completed", "auto_submitted"]);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!attempts || attempts.length === 0) {
      return NextResponse.json({
        unique_questions_practiced: 0,
        overall_accuracy: 0,
        avg_score: 0,
        tests_completed: 0,
        current_streak: 0,
        avg_time_per_question: 0,
        weakest_subject: null,
        strongest_subject: null,
        has_completed_attempts: false,
      });
    }

    // Query attempt_answers for this user's completed attempts to get exact correctness statistics
    const attemptIds = attempts.map((a) => a.id);
    const { data: answers } = await supabase
      .from("attempt_answers")
      .select("is_correct, is_visited, time_spent_seconds")
      .in("attempt_id", attemptIds);

    let totalPracticed = 0;
    let totalCorrect = 0;
    let totalAttempted = 0;
    let totalTimeSpent = 0;

    if (answers && answers.length > 0) {
      answers.forEach((ans) => {
        if (ans.is_visited) totalPracticed++;
        if (ans.is_correct !== null) {
          totalAttempted++;
          if (ans.is_correct) totalCorrect++;
        }
        totalTimeSpent += ans.time_spent_seconds || 0;
      });
    } else {
      totalPracticed = attempts.reduce((sum, a) => sum + (a.total_questions || 0), 0);
    }

    const totalScoreSum = attempts.reduce((sum, a) => sum + (a.score || 0), 0);
    const avgScore = attempts.length > 0 ? Math.round((totalScoreSum / attempts.length) * 10) / 10 : 0;
    const accuracyPct = totalAttempted > 0 ? Math.round((totalCorrect / totalAttempted) * 1000) / 10 : 0;
    const avgTimePerQ = totalPracticed > 0 ? Math.round(totalTimeSpent / totalPracticed) : 0;

    // Calculate streak (consecutive days with completed exam)
    const dates = attempts
      .map((a) => a.created_at ? new Date(a.created_at).toISOString().split("T")[0] : null)
      .filter(Boolean) as string[];

    const uniqueDates = Array.from(new Set(dates)).sort().reverse();
    let streak = 0;
    const today = new Date().toISOString().split("T")[0];

    if (uniqueDates.length > 0) {
      let currentDate = new Date(today);
      for (const dStr of uniqueDates) {
        const d = new Date(dStr);
        const diffDays = Math.round((currentDate.getTime() - d.getTime()) / (1000 * 3600 * 24));
        if (diffDays <= 1) {
          streak++;
          currentDate = d;
        } else {
          break;
        }
      }
    }

    // Weakest / strongest subject, derived honestly from per-attempt section
    // breakdowns (accuracy aggregated across attempts), not hardcoded.
    const subjectAgg: Record<string, { correct: number; answered: number }> = {};
    for (const a of attempts) {
      const sb = (a.section_breakdown ?? []) as Array<{
        subject?: string;
        correct?: number;
        answered?: number;
      }>;
      if (!Array.isArray(sb)) continue;
      for (const s of sb) {
        if (!s.subject) continue;
        const agg = (subjectAgg[s.subject] ??= { correct: 0, answered: 0 });
        agg.correct += s.correct ?? 0;
        agg.answered += s.answered ?? 0;
      }
    }
    const ranked = Object.entries(subjectAgg)
      .filter(([, v]) => v.answered > 0)
      .map(([subject, v]) => ({ subject, accuracy: v.correct / v.answered }))
      .sort((x, y) => x.accuracy - y.accuracy);

    return NextResponse.json({
      unique_questions_practiced: totalPracticed,
      overall_accuracy: accuracyPct,
      avg_score: avgScore,
      tests_completed: attempts.length,
      current_streak: streak,
      avg_time_per_question: avgTimePerQ,
      weakest_subject: ranked.length > 0 ? ranked[0].subject : null,
      strongest_subject: ranked.length > 0 ? ranked[ranked.length - 1].subject : null,
      has_completed_attempts: true,
    });
  } catch (err) {
    console.error("Analytics fetch error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
