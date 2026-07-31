import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

/**
 * GET /api/cbt/papers/[paperId]
 * Get a single paper with all its validated questions.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ paperId: string }> }
) {
  try {
    const supabase = createServerSupabaseClient();
    const { paperId } = await params;

    // Get paper metadata
    const { data: paper, error: paperError } = await supabase
      .from("papers")
      .select("*")
      .eq("paper_id", paperId)
      .single();

    if (paperError || !paper) {
      return NextResponse.json(
        { error: "Paper not found" },
        { status: 404 }
      );
    }

    // Get all questions for this paper
    const { data: questions, error: questionsError } = await supabase
      .from("validated_questions")
      .select("*")
      .eq("paper_id", paperId)
      .order("question_number", { ascending: true });

    if (questionsError) {
      return NextResponse.json(
        { error: questionsError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      paper,
      questions: questions || [],
      total_questions: questions?.length || 0,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
