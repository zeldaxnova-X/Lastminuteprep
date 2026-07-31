import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import type { QuestionsQueryParams } from "@/types/database.types";

/**
 * GET /api/cbt/questions
 * Fetch validated questions with optional filters.
 * Supports: subject, year, paper_type, paper_id, limit, offset, random
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const { searchParams } = new URL(request.url);

    const params: QuestionsQueryParams = {
      subject: searchParams.get("subject") as QuestionsQueryParams["subject"] || undefined,
      year: searchParams.get("year") ? parseInt(searchParams.get("year")!) : undefined,
      paper_type: searchParams.get("paper_type") as QuestionsQueryParams["paper_type"] || undefined,
      paper_id: searchParams.get("paper_id") || undefined,
      limit: searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : 25,
      offset: searchParams.get("offset") ? parseInt(searchParams.get("offset")!) : 0,
      random: searchParams.get("random") === "true",
    };

    let query = supabase
      .from("validated_questions")
      .select("*", { count: "exact" });

    if (params.subject) {
      query = query.eq("subject", params.subject);
    }
    if (params.year) {
      query = query.eq("year", params.year);
    }
    if (params.paper_id) {
      query = query.eq("paper_id", params.paper_id);
    }

    // For paper_type filter, join through papers table
    if (params.paper_type) {
      // Get paper_ids matching the type
      const { data: paperIds } = await supabase
        .from("papers")
        .select("paper_id")
        .eq("paper_type", params.paper_type);

      if (paperIds && paperIds.length > 0) {
        query = query.in("paper_id", paperIds.map((p) => p.paper_id));
      }
    }

    if (params.random) {
      // For random questions, we use a different approach
      // First get count, then select random IDs
      const { count } = await supabase
        .from("validated_questions")
        .select("*", { count: "exact", head: true });

      const totalCount = count || 0;
      const limit = Math.min(params.limit || 25, totalCount);

      // Generate random offset for variety
      const randomOffset = Math.floor(Math.random() * Math.max(0, totalCount - limit));
      query = query.range(randomOffset, randomOffset + limit - 1);
    } else {
      query = query
        .order("question_number", { ascending: true })
        .range(params.offset || 0, (params.offset || 0) + (params.limit || 25) - 1);
    }

    const { data, error, count } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      questions: data,
      total: count,
      limit: params.limit,
      offset: params.offset,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
