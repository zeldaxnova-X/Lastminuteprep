import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import type { BookmarkRequest } from "@/types/database.types";

/**
 * GET /api/cbt/bookmarks
 * Get all bookmarked questions for the current user.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();

    // Get user ID from auth header or use anonymous
    const authHeader = request.headers.get("Authorization");
    let userId = "00000000-0000-0000-0000-000000000000";
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) userId = user.id;
    }

    // Get bookmarks
    const { data: bookmarks, error } = await supabase
      .from("user_bookmarks")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Get the associated questions
    const questionIds = (bookmarks || []).map((b) => b.question_id);
    let questions: Record<string, unknown>[] = [];

    if (questionIds.length > 0) {
      const { data: qData } = await supabase
        .from("validated_questions")
        .select("*")
        .in("id", questionIds);
      questions = qData || [];
    }

    const questionMap = new Map(
      questions.map((q: Record<string, unknown>) => [q.id as string, q])
    );

    const bookmarksWithQuestions = (bookmarks || []).map((bookmark) => ({
      ...bookmark,
      question: questionMap.get(bookmark.question_id) || null,
    }));

    return NextResponse.json({
      bookmarks: bookmarksWithQuestions,
      total: bookmarksWithQuestions.length,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/cbt/bookmarks
 * Toggle bookmark on a question (add if not exists, remove if exists).
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const body: BookmarkRequest = await request.json();

    const authHeader = request.headers.get("Authorization");
    let userId = "00000000-0000-0000-0000-000000000000";
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) userId = user.id;
    }

    // Check if bookmark already exists
    const { data: existing } = await supabase
      .from("user_bookmarks")
      .select("id")
      .eq("user_id", userId)
      .eq("question_id", body.question_id)
      .single();

    if (existing) {
      // Remove bookmark
      await supabase
        .from("user_bookmarks")
        .delete()
        .eq("id", existing.id);

      return NextResponse.json({
        action: "removed",
        question_id: body.question_id,
      });
    } else {
      // Add bookmark
      const { data: newBookmark, error } = await supabase
        .from("user_bookmarks")
        .insert({
          user_id: userId,
          question_id: body.question_id,
          note: body.note || null,
        })
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({
        action: "added",
        bookmark: newBookmark,
      }, { status: 201 });
    }
  } catch (err) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/cbt/bookmarks
 * Remove a specific bookmark by question_id.
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const { searchParams } = new URL(request.url);
    const questionId = searchParams.get("question_id");

    if (!questionId) {
      return NextResponse.json(
        { error: "question_id is required" },
        { status: 400 }
      );
    }

    const authHeader = request.headers.get("Authorization");
    let userId = "00000000-0000-0000-0000-000000000000";
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) userId = user.id;
    }

    const { error } = await supabase
      .from("user_bookmarks")
      .delete()
      .eq("user_id", userId)
      .eq("question_id", questionId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ action: "removed", question_id: questionId });
  } catch (err) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
