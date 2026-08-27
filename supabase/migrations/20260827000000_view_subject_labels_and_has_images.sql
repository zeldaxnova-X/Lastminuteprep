-- ----------------------------------------------------------------------------
-- Fix the CBT engine's subject filtering + recover image-stem questions.
--
-- Problem 1 (topic tests broken): the exam engine, questions API, and
-- revision-queue filter `validated_questions.subject` with the app's display
-- names ("General Awareness", ...), but the view emitted the raw section slug
-- ("general_awareness"). Every subject_test / custom_test(subject) returned
-- zero rows, and random_test silently fell back to an unbalanced top-N scan.
-- Fix: emit `subject` as the display label (matching the `Subject` union type),
-- with the raw slug passed through for any unmapped section.
--
-- Problem 2 (33 image-stem questions excluded): isValidQuestion() accepts a
-- question when `has_images === true`, but the view never exposed that column,
-- so proper figure questions (image stem + real text options) were dropped from
-- mocks. Fix: expose `has_images`.
--
-- CREATE OR REPLACE keeps existing column names/types/positions (only the
-- `subject` EXPRESSION changes; `has_images` is appended last), so dependent
-- objects are undisturbed.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.validated_questions AS
SELECT
    q.id,
    q.paper_id,
    p.paper_name_canonical                            AS paper_name,
    p.year,
    p.shift,
    CASE q.section
        WHEN 'reasoning'             THEN 'General Intelligence & Reasoning'
        WHEN 'general_awareness'     THEN 'General Awareness'
        WHEN 'quantitative_aptitude' THEN 'Quantitative Aptitude'
        WHEN 'english_comprehension' THEN 'English Comprehension'
        ELSE q.section
    END                                               AS subject,
    q.question_number,
    q.stem_text                                       AS question_text,
    NULL::text                                        AS question_image,
    COALESCE(NULLIF(q.options->0->>'text', ''), CASE WHEN (q.options->0->>'isImage')::boolean THEN '[image]' END) AS option_a,
    COALESCE(NULLIF(q.options->1->>'text', ''), CASE WHEN (q.options->1->>'isImage')::boolean THEN '[image]' END) AS option_b,
    COALESCE(NULLIF(q.options->2->>'text', ''), CASE WHEN (q.options->2->>'isImage')::boolean THEN '[image]' END) AS option_c,
    COALESCE(NULLIF(q.options->3->>'text', ''), CASE WHEN (q.options->3->>'isImage')::boolean THEN '[image]' END) AS option_d,
    q.correct_option                                  AS correct_answer,
    q.solution_text                                   AS official_explanation,
    q.marks,
    q.negative_marks,
    q.source_document                                 AS source_pdf,
    q.dataset_version,
    q.section                                         AS section_slug,
    COALESCE(q.has_images, false)                     AS has_images
FROM public.questions q
JOIN public.papers p ON p.paper_id = q.paper_id;

COMMENT ON VIEW public.validated_questions IS 'Compatibility view over public.questions for the CBT engine/analytics. subject = display label (matches the Subject type); section_slug = raw slug; has_images exposed for the exam completeness filter. New code should read public.questions directly.';
