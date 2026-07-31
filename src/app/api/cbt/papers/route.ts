import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { formatPaperDisplayName } from "@/lib/paper-formatter";

/**
 * GET /api/cbt/papers
 * List all validated previous year papers (100 questions) with user-friendly display names.
 * Supports: paper_type, year, tier filters
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const { searchParams } = new URL(request.url);

    const paperType = searchParams.get("paper_type");
    const year = searchParams.get("year");
    const tier = searchParams.get("tier");

    let query = supabase
      .from("papers")
      .select("*")
      .order("year", { ascending: false })
      .order("paper_name_canonical", { ascending: true });

    if (paperType) {
      query = query.eq("paper_type", paperType);
    }
    if (year) {
      query = query.eq("year", parseInt(year));
    }
    if (tier) {
      query = query.eq("tier", tier);
    }

    // Only return complete, fully validated 100-question papers
    const includeEmpty = searchParams.get("include_empty") === "true";
    if (!includeEmpty) {
      query = query.gte("validated_questions", 100);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const formattedPapers = (data || []).map((paper, idx) => ({
      ...paper,
      display_name: formatPaperDisplayName(paper, idx),
    }));

    return NextResponse.json({
      papers: formattedPapers,
      total: formattedPapers.length,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
