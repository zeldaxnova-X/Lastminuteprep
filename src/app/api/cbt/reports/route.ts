import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

/**
 * POST /api/cbt/reports
 * Submit a report for a broken or incorrect question.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const body = await request.json();

    const authHeader = request.headers.get("Authorization");
    let userId = "00000000-0000-0000-0000-000000000000";
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) userId = user.id;
    }

    if (!body.question_id || !body.report_type) {
      return NextResponse.json(
        { error: "question_id and report_type are required" },
        { status: 400 }
      );
    }

    const validReportTypes = [
      "wrong_answer", "wrong_question", "wrong_options", "wrong_explanation",
      "missing_image", "formatting_issue", "duplicate", "other"
    ];

    if (!validReportTypes.includes(body.report_type)) {
      return NextResponse.json(
        { error: `report_type must be one of: ${validReportTypes.join(", ")}` },
        { status: 400 }
      );
    }

    const { data: report, error } = await supabase
      .from("question_reports")
      .insert({
        user_id: userId,
        question_id: body.question_id,
        report_type: body.report_type,
        description: body.description || null,
        status: "pending",
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ report }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
