-- ----------------------------------------------------------------------------
-- Per-user unique-question tracking for mock/topic tests.
--
-- Goal: every user gets questions they haven't done yet (unique per user, and
-- independent between users); once they exhaust the pool it recycles so a test
-- never fails; and we can show "done / remaining" coverage per subject.
--
-- "Done/seen" = a question the user actually ANSWERED (selected_option set) OR
-- that was part of a test they FINISHED (completed / auto_submitted). Merely
-- starting-then-abandoning a test does NOT burn its unanswered questions.
--
-- Three objects, all additive:
--   1. cbt_valid_questions  — the exam-eligible pool (encodes the app's
--      isValidQuestion() rule ONCE, in SQL, so picker + coverage agree).
--   2. cbt_pick_unique_questions() — unseen-first picker (recycles when short).
--   3. cbt_user_coverage()  — per-subject total / done / remaining.
-- ----------------------------------------------------------------------------

-- 1. Exam-eligible pool. Mirrors isValidQuestion() in
--    src/app/api/cbt/exams/start/route.ts (keep the two in sync).
CREATE OR REPLACE VIEW public.cbt_valid_questions AS
SELECT v.*
FROM public.validated_questions v
WHERE v.correct_answer IN ('A', 'B', 'C', 'D')
  AND COALESCE(btrim(v.option_a), '') <> ''
  AND COALESCE(btrim(v.option_b), '') <> ''
  AND COALESCE(btrim(v.option_c), '') <> ''
  AND COALESCE(btrim(v.option_d), '') <> ''
  AND btrim(v.option_a) NOT IN ('Option A','Option B','Option C','Option D','Option 1','Option 2','Option 3','Option 4')
  AND btrim(v.option_b) NOT IN ('Option A','Option B','Option C','Option D','Option 1','Option 2','Option 3','Option 4')
  AND btrim(v.option_c) NOT IN ('Option A','Option B','Option C','Option D','Option 1','Option 2','Option 3','Option 4')
  AND btrim(v.option_d) NOT IN ('Option A','Option B','Option C','Option D','Option 1','Option 2','Option 3','Option 4')
  AND (
        COALESCE(btrim(v.question_text), '') <> ''
     OR '[image]' IN (v.option_a, v.option_b, v.option_c, v.option_d)
     OR v.has_images IS TRUE
      );

COMMENT ON VIEW public.cbt_valid_questions IS 'Exam-eligible question pool: validated_questions rows that pass the CBT completeness rule (answer + 4 real options + stem-or-image). Single SQL source of truth shared by the unique-picker and coverage functions.';

-- 2. Unseen-first picker. Returns up to p_limit exam-eligible questions for the
--    user, preferring ones they have not done; fills the remainder with already
--    seen questions (random) so a test is never short. p_subject / p_year NULL =
--    no filter on that dimension.
CREATE OR REPLACE FUNCTION public.cbt_pick_unique_questions(
    p_user    uuid,
    p_subject text DEFAULT NULL,
    p_limit   integer DEFAULT 100,
    p_year    integer DEFAULT NULL
)
RETURNS SETOF public.cbt_valid_questions
LANGUAGE sql
STABLE
AS $$
    WITH seen AS (
        SELECT DISTINCT aa.question_id
        FROM public.attempt_answers aa
        JOIN public.exam_attempts ea ON ea.id = aa.attempt_id
        WHERE ea.user_id = p_user
          AND (aa.selected_option IS NOT NULL
               OR ea.status IN ('completed', 'auto_submitted'))
    )
    SELECT q.*
    FROM public.cbt_valid_questions q
    LEFT JOIN seen s ON s.question_id = q.id
    WHERE (p_subject IS NULL OR q.subject = p_subject)
      AND (p_year IS NULL OR q.year = p_year)
    ORDER BY (s.question_id IS NOT NULL), random()
    LIMIT GREATEST(p_limit, 0);
$$;

COMMENT ON FUNCTION public.cbt_pick_unique_questions IS 'Pick up to p_limit exam-eligible questions for p_user, unseen-first (recycles seen when the unseen pool is short). Optional p_subject / p_year filters.';

-- 3. Coverage: per-subject total / done / remaining for the user.
CREATE OR REPLACE FUNCTION public.cbt_user_coverage(p_user uuid)
RETURNS TABLE (subject text, total bigint, done bigint, remaining bigint)
LANGUAGE sql
STABLE
AS $$
    WITH seen AS (
        SELECT DISTINCT aa.question_id
        FROM public.attempt_answers aa
        JOIN public.exam_attempts ea ON ea.id = aa.attempt_id
        WHERE ea.user_id = p_user
          AND (aa.selected_option IS NOT NULL
               OR ea.status IN ('completed', 'auto_submitted'))
    )
    SELECT q.subject,
           COUNT(*)::bigint                                   AS total,
           COUNT(s.question_id)::bigint                       AS done,
           (COUNT(*) - COUNT(s.question_id))::bigint          AS remaining
    FROM public.cbt_valid_questions q
    LEFT JOIN seen s ON s.question_id = q.id
    GROUP BY q.subject
    ORDER BY q.subject;
$$;

COMMENT ON FUNCTION public.cbt_user_coverage IS 'Per-subject exam-pool coverage for p_user: total eligible, done (answered or in a finished test), remaining.';

GRANT SELECT ON public.cbt_valid_questions TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cbt_pick_unique_questions(uuid, text, integer, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cbt_user_coverage(uuid) TO authenticated, service_role;
