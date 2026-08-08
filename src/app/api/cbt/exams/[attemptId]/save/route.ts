import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import type { SaveAnswerRequest } from "@/types/database.types";

/**
 * POST /api/cbt/exams/[attemptId]/save
 * Save a single answer during an exam.
 * Supports: selecting/clearing an option, marking for review, time tracking.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  try {
    const supabase = createServerSupabaseClient();
    const { attemptId } = await params;
    const body: SaveAnswerRequest = await request.json();

    // Verify attempt is still in progress
    const { data: attempt, error: attemptError } = await supabase
      .from("exam_attempts")
      .select("id, status")
      .eq("id", attemptId)
      .single();

    if (attemptError || !attempt) {
      return NextResponse.json(
        { error: "Exam attempt not found" },
        { status: 404 }
      );
    }

    if (attempt.status !== "in_progress") {
      return NextResponse.json(
        { error: "Exam is no longer in progress" },
        { status: 400 }
      );
    }

    // Upsert the answer
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.selected_option !== undefined) {
      updateData.selected_option = body.selected_option;
    }
    if (body.is_marked_for_review !== undefined) {
      updateData.is_marked_for_review = body.is_marked_for_review;
    }
    if (body.is_visited !== undefined) {
      updateData.is_visited = body.is_visited;
    }
    if (body.time_spent_seconds !== undefined) {
      updateData.time_spent_seconds = body.time_spent_seconds;
    }
    // Confidence (guessed|unsure|confident) — the AI Mentor's key signal (§4).
    if (body.confidence !== undefined) {
      updateData.confidence = body.confidence;
    }

    const { data: answer, error: answerError } = await supabase
      .from("attempt_answers")
      .update(updateData)
      .eq("attempt_id", attemptId)
      .eq("question_id", body.question_id)
      .select()
      .single();

    if (answerError) {
      return NextResponse.json(
        { error: answerError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ answer });
  } catch (err) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
