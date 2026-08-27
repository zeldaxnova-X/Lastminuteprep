import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import {
  readDeviceToken,
  setDeviceCookie,
  json401,
  attemptWriteClient,
} from "@/lib/auth/api-guard";
import { getViewer } from "@/lib/auth/plan";
import { enrichWithRichContent, stripAnswerKey } from "@/lib/cbt-questions";
import type { StartExamRequest, StartExamResponse, ValidatedQuestion, Subject } from "@/types/database.types";

/** The only anonymous path: the one-time 20-question random sample. */
function isSampleRequest(body: StartExamRequest): boolean {
  return body.exam_type === "random_test" && (body.total_questions ?? 100) <= 20;
}

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

    // Identity is server-derived. Real exams require a signed-in account; only
    // the one-time 20-Q sample may run anonymously (guarded by a device token).
    const viewer = await getViewer();
    const sessionUserId = viewer.userId;
    const sample = isSampleRequest(body);

    if (!sample && !sessionUserId) return json401();

    // Plan gate (paywall at the source): FREE users may ONLY start the sample.
    // Any real exam (pyp/subject/random/custom) requires a paid plan. Enforced
    // server-side so a direct /start call can't bypass the gated UI. PRO/MENTOR
    // are unaffected; the anonymous sample is exempt (sample === true).
    if (!sample && viewer.plan === "free") {
      return NextResponse.json(
        {
          error: "upgrade_required",
          message: "Starting full tests requires Pro. Upgrade to unlock the question bank.",
        },
        { status: 403 }
      );
    }

    // Anonymous-sample guard: one sample per durable device token. Signed-in
    // users skip the device gate (they own the row via user_id).
    let deviceToken: string | null = null;
    let newDeviceToken: string | null = null;
    if (sample && !sessionUserId) {
      deviceToken = await readDeviceToken();
      if (deviceToken) {
        const { data: prior } = await supabase
          .from("sample_attempts")
          .select("device_token")
          .eq("device_token", deviceToken)
          .maybeSingle();
        if (prior) {
          return NextResponse.json(
            { error: "sample_used", message: "You've already used your free sample on this device." },
            { status: 409 }
          );
        }
      } else {
        newDeviceToken = randomUUID();
        deviceToken = newDeviceToken;
      }
    }

    const userId = sessionUserId ?? null;
    const deviceId = sessionUserId ? null : deviceToken;

    // Attempt-write client comes from the ONE helper (see attemptWriteClient):
    // authed → user-scoped (RLS stamps user_id=auth.uid()); anonymous sample →
    // service role (user_id NULL + device_id; RLS can't key on a no-session
    // request). Never select this client inline here — that has regressed twice.
    // Reference reads + the sample_attempts ledger stay on `supabase` (service).
    const writeDb = await attemptWriteClient(sessionUserId);

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

        // Topic tests always require a signed-in user (guarded above), so serve
        // questions this user hasn't done yet.
        const validList = await pickUniqueQuestions(
          supabase,
          sessionUserId as string,
          body.subject,
          totalQuestions,
          null
        );
        questions = deduplicateQuestions(validList).slice(0, totalQuestions);
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

        if (sessionUserId) {
          // Signed-in: balanced pull of questions this user hasn't done yet
          // (unseen-first per subject), then top up across all subjects.
          for (const subj of subjects) {
            const picked = await pickUniqueQuestions(
              supabase,
              sessionUserId,
              subj,
              questionsPerSubject,
              null
            );
            collected = [...collected, ...deduplicateQuestions(picked).slice(0, questionsPerSubject)];
          }
          if (collected.length < totalQuestions) {
            const extra = await pickUniqueQuestions(supabase, sessionUserId, null, totalQuestions, null);
            for (const q of extra) {
              if (collected.length >= totalQuestions) break;
              if (!collected.some((existing) => existing.id === q.id)) collected.push(q);
            }
          }
        } else {
          // Anonymous 20-Q sample: no per-user history to track, so pull a
          // balanced random set from the eligible pool.
          for (const subj of subjects) {
            const { data, error } = await supabase
              .from("validated_questions")
              .select("*")
              .eq("subject", subj)
              .limit(150);

            if (!error && data) {
              const validSubj = (data as ValidatedQuestion[]).filter(isValidQuestion);
              const uniqueSubj = deduplicateQuestions(shuffleArray(validSubj)).slice(0, questionsPerSubject);
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
                if (!collected.some((existing) => existing.id === q.id)) collected.push(q);
              }
            }
          }
        }

        questions = collected;
        break;
      }

      case "custom_test": {
        title = title || "Custom Practice Test";

        // Custom tests require a signed-in user (guarded above); serve unseen
        // questions honouring the optional subject / year filters.
        const validList = await pickUniqueQuestions(
          supabase,
          sessionUserId as string,
          body.subject || null,
          totalQuestions,
          body.year || null
        );
        questions = deduplicateQuestions(validList).slice(0, totalQuestions);
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
    const { data: attempt, error: attemptError } = await writeDb
      .from("exam_attempts")
      .insert({
        user_id: userId,
        device_id: deviceId,
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

    const { error: answersError } = await writeDb.from("attempt_answers").insert(answerRows);

    if (answersError) {
      await writeDb.from("exam_attempts").delete().eq("id", attempt.id);
      return NextResponse.json({ error: answersError.message }, { status: 500 });
    }

    // Ensure rich content is attached (non-paper flows weren't enriched yet),
    // then remove the answer key before returning to the client.
    if (questions.length && questions[0].stem === undefined) {
      questions = (await enrichWithRichContent(supabase, questions)) as ValidatedQuestion[];
    }
    questions = stripAnswerKey(questions);

    // Record the anonymous sample against the device token (the server-side
    // one-time ledger — resists localStorage clearing).
    if (sample && !sessionUserId && deviceToken) {
      const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
      await supabase.from("sample_attempts").upsert(
        {
          device_token: deviceToken,
          attempt_id: attempt.id,
          ip,
          user_agent: request.headers.get("user-agent")?.slice(0, 300) || null,
        },
        { onConflict: "device_token" }
      );
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

    const res = NextResponse.json(response, { status: 201 });
    if (newDeviceToken) setDeviceCookie(res, newDeviceToken);
    return res;
  } catch (err) {
    console.error("Start exam error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * Per-user unique-question picker. Delegates to the SQL RPC
 * `cbt_pick_unique_questions`, which returns exam-eligible questions the user
 * has NOT done yet (unseen-first, recycling seen ones only when the unseen pool
 * runs short so a test is never under-filled). isValidQuestion is re-applied as
 * a defensive net — the RPC's `cbt_valid_questions` view already encodes it.
 */
async function pickUniqueQuestions(
  supabase: SupabaseClient,
  userId: string,
  subject: string | null,
  limit: number,
  year: number | null
): Promise<ValidatedQuestion[]> {
  const { data, error } = await supabase.rpc("cbt_pick_unique_questions", {
    p_user: userId,
    p_subject: subject,
    p_limit: limit,
    p_year: year,
  });
  if (error || !data) return [];
  return (data as ValidatedQuestion[]).filter(isValidQuestion);
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
