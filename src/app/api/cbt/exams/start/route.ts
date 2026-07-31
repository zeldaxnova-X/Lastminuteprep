import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import type { StartExamRequest, StartExamResponse, ValidatedQuestion, Subject } from "@/types/database.types";

const DEV_USER_ID = "00000000-0000-0000-0000-000000000001";

/**
 * Validate question completeness & non-placeholder options.
 * Exclude any question with missing/empty/placeholder options.
 */
function isValidQuestion(q: ValidatedQuestion): boolean {
  if (!q.id || !q.question_text || !q.question_text.trim()) return false;
  if (!q.option_a || !q.option_a.trim()) return false;
  if (!q.option_b || !q.option_b.trim()) return false;
  if (!q.option_c || !q.option_c.trim()) return false;
  if (!q.option_d || !q.option_d.trim()) return false;
  if (!q.correct_answer || !["A", "B", "C", "D"].includes(q.correct_answer)) return false;

  const a = q.option_a.trim();
  const b = q.option_b.trim();
  const c = q.option_c.trim();
  const d = q.option_d.trim();

  // Exclude placeholder text
  if (
    a === "Option A" || b === "Option B" || c === "Option C" || d === "Option D" ||
    a === "Option 1" || b === "Option 2" || c === "Option 3" || d === "Option 4"
  ) {
    return false;
  }

  return true;
}

/**
 * POST /api/cbt/exams/start
 * Start a new exam attempt.
 * Modes: previous_year_paper, subject_test, random_test, custom_test
 * Enforces 100% complete options & zero duplicate question IDs.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const body: StartExamRequest = await request.json();
    const userId = DEV_USER_ID;

    let questions: ValidatedQuestion[] = [];
    let title = body.title || "";
    const totalQuestions = body.total_questions || 100;
    const timeLimitSeconds = (body.time_limit_minutes || 60) * 60;

    switch (body.exam_type) {
      case "previous_year_paper": {
        if (!body.paper_id) {
          return NextResponse.json(
            { error: "paper_id is required for previous_year_paper" },
            { status: 400 }
          );
        }

        const { data: paper } = await supabase
          .from("papers")
          .select("paper_name_canonical, year, shift, tier, paper_type")
          .eq("paper_id", body.paper_id)
          .single();

        if (!paper) {
          return NextResponse.json({ error: "Paper not found" }, { status: 404 });
        }

        title = title || formatPaperTitle(paper);

        const { data, error } = await supabase
          .from("validated_questions")
          .select("*")
          .eq("paper_id", body.paper_id)
          .order("question_number", { ascending: true });

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
        questions = ((data as ValidatedQuestion[]) || []).filter(isValidQuestion);
        break;
      }

      case "subject_test": {
        if (!body.subject) {
          return NextResponse.json(
            { error: "subject is required for subject_test" },
            { status: 400 }
          );
        }

        title = title || `${body.subject} — Practice Test`;

        const { data, error } = await supabase
          .from("validated_questions")
          .select("*")
          .eq("subject", body.subject)
          .limit(totalQuestions * 4);

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        const validList = ((data as ValidatedQuestion[]) || []).filter(isValidQuestion);
        const shuffled = shuffleArray(validList);
        questions = deduplicateQuestions(shuffled).slice(0, totalQuestions);
        break;
      }

      case "random_test": {
        title = title || "SSC CGL Full Length Mock Test";

        const subjects: Subject[] = [
          "General Intelligence & Reasoning",
          "General Awareness",
          "Quantitative Aptitude",
          "English Comprehension",
        ];

        const questionsPerSubject = Math.floor(totalQuestions / 4);
        let collected: ValidatedQuestion[] = [];

        for (const subj of subjects) {
          const { data, error } = await supabase
            .from("validated_questions")
            .select("*")
            .eq("subject", subj)
            .limit(150);

          if (!error && data) {
            const validSubj = (data as ValidatedQuestion[]).filter(isValidQuestion);
            const shuffledSubj = shuffleArray(validSubj);
            const uniqueSubj = deduplicateQuestions(shuffledSubj).slice(0, questionsPerSubject);
            collected = [...collected, ...uniqueSubj];
          }
        }

        if (collected.length < totalQuestions) {
          const { data } = await supabase
            .from("validated_questions")
            .select("*")
            .limit(totalQuestions * 3);

          if (data) {
            const extra = shuffleArray((data as ValidatedQuestion[]).filter(isValidQuestion));
            for (const q of extra) {
              if (collected.length >= totalQuestions) break;
              if (!collected.some((existing) => existing.id === q.id)) {
                collected.push(q);
              }
            }
          }
        }

        questions = collected;
        break;
      }

      case "custom_test": {
        title = title || "Custom Practice Test";

        let query = supabase.from("validated_questions").select("*").limit(totalQuestions * 4);

        if (body.subject) query = query.eq("subject", body.subject);
        if (body.year) query = query.eq("year", body.year);

        const { data, error } = await query;

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        const validList = ((data as ValidatedQuestion[]) || []).filter(isValidQuestion);
        const shuffled = shuffleArray(validList);
        questions = deduplicateQuestions(shuffled).slice(0, totalQuestions);
        break;
      }

      default:
        return NextResponse.json({ error: "Invalid exam_type" }, { status: 400 });
    }

    if (questions.length === 0) {
      return NextResponse.json(
        { error: "No valid questions found for the given criteria" },
        { status: 404 }
      );
    }

    // STRICT VALIDATION AUDIT
    const invalidItem = questions.find((q) => !isValidQuestion(q));
    if (invalidItem) {
      console.error(`Invalid question detected: Q ID ${invalidItem.id}`);
      return NextResponse.json(
        { error: `Validation failed: Incomplete question detected (ID: ${invalidItem.id}). Attempt aborted.` },
        { status: 500 }
      );
    }

    // CRITICAL DEDUPLICATION CHECK
    const uniqueIds = new Set(questions.map((q) => q.id));
    if (uniqueIds.size !== questions.length) {
      console.error(`Duplicate question IDs detected in test generation! Unique: ${uniqueIds.size}, Total: ${questions.length}`);
      return NextResponse.json(
        { error: "Duplicate question detected during test generation. Attempt aborted." },
        { status: 500 }
      );
    }

    // Create exam attempt
    const { data: attempt, error: attemptError } = await supabase
      .from("exam_attempts")
      .insert({
        user_id: userId,
        exam_type: body.exam_type,
        paper_id: body.paper_id || null,
        title,
        subject_filter: body.subject || null,
        year_filter: body.year || null,
        paper_type_filter: body.paper_type || null,
        total_questions: questions.length,
        time_limit_seconds: timeLimitSeconds,
        marks_per_question: 2.0,
        negative_marks_per_question: 0.5,
        status: "in_progress",
        max_score: questions.length * 2.0,
      })
      .select()
      .single();

    if (attemptError) {
      return NextResponse.json({ error: attemptError.message }, { status: 500 });
    }

    // Create attempt_answers for each question
    const answerRows = questions.map((q, index) => ({
      attempt_id: attempt.id,
      question_id: q.id,
      question_index: index,
      selected_option: null,
      is_correct: null,
      is_marked_for_review: false,
      is_visited: index === 0,
      marks_awarded: 0,
      time_spent_seconds: 0,
    }));

    const { error: answersError } = await supabase.from("attempt_answers").insert(answerRows);

    if (answersError) {
      await supabase.from("exam_attempts").delete().eq("id", attempt.id);
      return NextResponse.json({ error: answersError.message }, { status: 500 });
    }

    const response: StartExamResponse = {
      attempt_id: attempt.id,
      exam_type: body.exam_type,
      title,
      total_questions: questions.length,
      time_limit_seconds: timeLimitSeconds,
      questions,
      started_at: attempt.started_at,
    };

    return NextResponse.json(response, { status: 201 });
  } catch (err) {
    console.error("Start exam error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

function deduplicateQuestions(array: ValidatedQuestion[]): ValidatedQuestion[] {
  const seen = new Set<string>();
  const result: ValidatedQuestion[] = [];
  for (const item of array) {
    if (!seen.has(item.id)) {
      seen.add(item.id);
      result.push(item);
    }
  }
  return result;
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function formatPaperTitle(paper: {
  paper_name_canonical?: string;
  year?: number;
  shift?: string | null;
  tier?: string | null;
  paper_type?: string | null;
}): string {
  const year = paper.year || 2024;
  const tier = paper.tier?.includes("2") || paper.tier?.includes("II") ? "Tier II" : "Tier I";

  let shift = "";
  if (paper.shift) {
    const s = paper.shift.toLowerCase();
    if (s.includes("1")) shift = "Shift 1";
    else if (s.includes("2")) shift = "Shift 2";
    else if (s.includes("3")) shift = "Shift 3";
    else if (s.includes("4")) shift = "Shift 4";
    else shift = paper.shift;
  }

  return shift ? `SSC CGL ${year} ${tier} ${shift}` : `SSC CGL ${year} ${tier}`;
}
