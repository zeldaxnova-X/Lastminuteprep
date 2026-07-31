import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

/**
 * GET /api/cbt/exams/[attemptId]/result
 * Get the full result of a completed exam attempt.
 * Includes attempt metadata, all answers with questions, and section breakdown.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  try {
    const supabase = createServerSupabaseClient();
    const { attemptId } = await params;

    // Get the exam attempt
    const { data: attempt, error: attemptError } = await supabase
      .from("exam_attempts")
      .select("*")
      .eq("id", attemptId)
      .single();

    if (attemptError || !attempt) {
      return NextResponse.json(
        { error: "Exam attempt not found" },
        { status: 404 }
      );
    }

    if (attempt.status === "in_progress") {
      return NextResponse.json(
        { error: "Exam is still in progress. Submit first." },
        { status: 400 }
      );
    }

    // Get all answers ordered by question index
    const { data: answers, error: answersError } = await supabase
      .from("attempt_answers")
      .select("*")
      .eq("attempt_id", attemptId)
      .order("question_index", { ascending: true });

    if (answersError) {
      return NextResponse.json({ error: answersError.message }, { status: 500 });
    }

    // Get all questions for this attempt
    const questionIds = (answers || []).map((a) => a.question_id);
    const { data: questions, error: questionsError } = await supabase
      .from("validated_questions")
      .select("*")
      .in("id", questionIds);

    if (questionsError) {
      return NextResponse.json({ error: questionsError.message }, { status: 500 });
    }

    const questionMap = new Map(
      (questions || []).map((q) => [q.id, q])
    );

    // Merge answers with questions
    const answersWithQuestions = (answers || []).map((answer) => ({
      ...answer,
      question: questionMap.get(answer.question_id) || null,
    }));

    return NextResponse.json({
      attempt,
      answers: answersWithQuestions,
      section_breakdown: attempt.section_breakdown || [],
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
