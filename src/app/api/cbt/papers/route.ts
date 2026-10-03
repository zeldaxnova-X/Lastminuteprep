import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { formatPaperDisplayName } from "@/lib/paper-formatter";
import { examContent } from "@/lib/exam/content-repo";
import { getExamEntry, DEFAULT_EXAM_CODE } from "@/lib/exam/registry";

/**
 * GET /api/cbt/papers
 * List an exam's validated previous-year papers with user-friendly display names.
 * Scoped by ?exam=<code> (defaults to SSC CGL). Supports paper_type, year, tier.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const { searchParams } = new URL(request.url);

    const examEntry = getExamEntry(searchParams.get("exam"));
    const examCode = examEntry.code;
    const examName = examEntry.builtinConfig.examName;
    const isDefaultExam = examCode === DEFAULT_EXAM_CODE;
    const paperType = searchParams.get("paper_type");
    const year = searchParams.get("year");
    const tier = searchParams.get("tier");

    let query = examContent(supabase, examCode)
      .papers()
      .select("*")
      .order("year", { ascending: false, nullsFirst: false }) // dated papers first
      .order("paper_name_canonical", { ascending: true });

    if (paperType) {
      query = query.eq("paper_type", paperType);
    }
    if (year) {
      query = query.eq("year", parseInt(year));
    }
    if (isDefaultExam) {
      // SSC-only hygiene: default to Tier 1 (recovered Tier-2 papers stay hidden)
      // and to the active v2 (DOCX) dataset. Other exams list all published papers.
      query = tier ? query.eq("tier", tier) : query.eq("tier", "Tier 1");
      const includeLegacy = searchParams.get("include_legacy") === "true";
      if (!includeLegacy) query = query.eq("dataset_version", "2.0");
    } else {
      query = query.eq("published", true);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Undated memory-based papers get a sequential "Set N" (1..N) rather than a
    // global index, so the dropdown reads cleanly.
    let undated = 0;
    const dateRe = /\d{1,2}(?:st|nd|rd|th)?[-_ ]?(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[-_ ,]*20\d{2}/i;
    const formattedPapers = (data || []).map((paper, idx) => {
      const hay = [paper.paper_name_canonical, paper.paper_name_original, paper.source_document].filter(Boolean).join(" ");
      const hasMeta = !!paper.year || !!paper.shift || dateRe.test(hay);
      return {
        ...paper,
        display_name: formatPaperDisplayName(paper, hasMeta ? idx : undated++, examName),
      };
    });

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
