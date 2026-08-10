import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { enrichWithRichContent, stripAnswerKey } from "@/lib/cbt-questions";
import type { StartExamRequest, StartExamResponse, ValidatedQuestion, Subject } from "@/types/database.types";

// Anonymous fallback identity for signed-out sample attempts.
//   // TODO: replace with a null user_id + device_id once sample sessions are
//   //       claimed onto a real account at first login.
const DEV_USER_ID = "00000000-0000-0000-0000-000000000001";

/**
 * Validate question completeness for exam inclusion (v2 dataset).
 * Accepts image-based questions (stem and/or options rendered as images) — the
 * only hard requirements are four options and a verified answer key. Questions
 * still flagged `needs_answer_key` (no correct_answer) are excluded so that
 * unkeyed items never appear in a scored exam.
 */
function isValidQuestion(q: ValidatedQuestion): boolean {
  if (!q.id) return false;
  if (!q.correct_answer || !["A", "B", "C", "D"].includes(q.correct_answer)) return false;

  const opts = [q.option_a, q.option_b, q.option_c, q.option_d].map((o) => (o || "").trim());
  if (opts.some((o) => !o)) return false; // all four options must be present ("[image]" counts)

  // Exclude synthetic placeholder text.
  const placeholders = new Set([
    "Option A", "Option B", "Option C", "Option D",
    "Option 1", "Option 2", "Option 3", "Option 4",
  ]);
  if (opts.some((o) => placeholders.has(o))) return false;

  // A question must have either stem text or image content.
  const hasStem = !!(q.question_text && q.question_text.trim());
  const hasImageOptions = opts.some((o) => o === "[image]");
  return hasStem || hasImageOptions || q.has_images === true;
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

    // Wire the attempt to the signed-in user when present; fall back to the
    // anonymous demo identity so the frictionless (no-login) sample still works.
    const authClient = await createSupabaseServerClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();
    const userId = user?.id ?? DEV_USER_ID;

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
        // Enrich before validating so image-based questions are recognised.
        const enrichedPaper = await enrichWithRichContent(supabase, (data as ValidatedQuestion[]) || []);
        questions = (enrichedPaper as ValidatedQuestion[]).filter(isValidQuestion);
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

    // Ensure rich content is attached (non-paper flows weren't enriched yet),
    // then remove the answer key before returning to the client.
    if (questions.length && questions[0].stem === undefined) {
      questions = (await enrichWithRichContent(supabase, questions)) as ValidatedQuestion[];
    }
    questions = stripAnswerKey(questions);

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
