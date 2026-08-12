import { NextRequest, NextResponse } from "next/server";
import { getSessionContext, json401 } from "@/lib/auth/api-guard";
import type { BookmarkRequest } from "@/types/database.types";

/**
 * Bookmarks are per-user and require a signed-in account. Identity comes from
 * the session (never a client-supplied header); the user-scoped client means
 * RLS also confines rows to auth.uid().
 */

/** GET /api/cbt/bookmarks — the signed-in user's bookmarked questions. */
export async function GET() {
  try {
    const { user, supabase } = await getSessionContext();
    if (!user) return json401();

    const { data: bookmarks, error } = await supabase
      .from("user_bookmarks")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const questionIds = (bookmarks || []).map((b) => b.question_id);
    let questions: Record<string, unknown>[] = [];
    if (questionIds.length > 0) {
      const { data: qData } = await supabase
        .from("validated_questions")
        .select("*")
        .in("id", questionIds);
      questions = qData || [];
    }
    const questionMap = new Map(questions.map((q) => [q.id as string, q]));
    const bookmarksWithQuestions = (bookmarks || []).map((bookmark) => ({
      ...bookmark,
      question: questionMap.get(bookmark.question_id) || null,
    }));

    return NextResponse.json({
      bookmarks: bookmarksWithQuestions,
      total: bookmarksWithQuestions.length,
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** POST /api/cbt/bookmarks — toggle a bookmark for the signed-in user. */
export async function POST(request: NextRequest) {
  try {
    const { user, supabase } = await getSessionContext();
    if (!user) return json401();
    const body: BookmarkRequest = await request.json();

    const { data: existing } = await supabase
      .from("user_bookmarks")
      .select("id")
      .eq("user_id", user.id)
      .eq("question_id", body.question_id)
      .maybeSingle();

    if (existing) {
      await supabase.from("user_bookmarks").delete().eq("id", existing.id).eq("user_id", user.id);
      return NextResponse.json({ action: "removed", question_id: body.question_id });
    }

    const { data: newBookmark, error } = await supabase
      .from("user_bookmarks")
      .insert({ user_id: user.id, question_id: body.question_id, note: body.note || null })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ action: "added", bookmark: newBookmark }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** DELETE /api/cbt/bookmarks?question_id=… — remove one of the user's bookmarks. */
export async function DELETE(request: NextRequest) {
  try {
    const { user, supabase } = await getSessionContext();
    if (!user) return json401();
    const questionId = new URL(request.url).searchParams.get("question_id");
    if (!questionId) return NextResponse.json({ error: "question_id is required" }, { status: 400 });

    const { error } = await supabase
      .from("user_bookmarks")
      .delete()
      .eq("user_id", user.id)
      .eq("question_id", questionId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ action: "removed", question_id: questionId });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
