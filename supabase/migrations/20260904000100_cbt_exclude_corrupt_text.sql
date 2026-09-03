-- ----------------------------------------------------------------------------
-- Gate out font-corrupted questions from the CBT pool.
--
-- Some source PDFs embed a broken (non-Unicode) font for certain questions, so
-- the original text extraction produced garbage that landed in `questions` as
-- mangled Devanagari (e.g. 2-Dec-2022 Sh1 Q16 "Panda : Bamboo :: Koala : ?").
-- These are English Tier-1 papers, so any Devanagari in the question or option
-- text is corruption, never legitimate content. cbt_valid_questions is the
-- single source the CBT engine selects from; add a filter excluding any row
-- whose text contains a Devanagari-block character (U+0900..U+097F).
--
-- This is self-maintaining: when a corrupted question is rebuilt to clean
-- English it stops matching and re-enters the pool automatically. Unsourced
-- corrupted questions (no clean copy exists) stay gated.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.cbt_valid_questions AS
 SELECT v.id,
    v.paper_id,
    v.paper_name,
    v.year,
    v.shift,
    v.subject,
    v.question_number,
    v.question_text,
    v.question_image,
    v.option_a,
    v.option_b,
    v.option_c,
    v.option_d,
    v.correct_answer,
    v.official_explanation,
    v.marks,
    v.negative_marks,
    v.source_pdf,
    v.dataset_version,
    v.section_slug,
    v.has_images
   FROM validated_questions v
     JOIN papers p ON p.paper_id = v.paper_id
  WHERE p.tier = 'Tier 1'::text
    AND (v.correct_answer = ANY (ARRAY['A'::bpchar, 'B'::bpchar, 'C'::bpchar, 'D'::bpchar]))
    AND COALESCE(btrim(v.option_a), ''::text) <> ''::text
    AND COALESCE(btrim(v.option_b), ''::text) <> ''::text
    AND COALESCE(btrim(v.option_c), ''::text) <> ''::text
    AND COALESCE(btrim(v.option_d), ''::text) <> ''::text
    AND (btrim(v.option_a) <> ALL (ARRAY['Option A'::text, 'Option B'::text, 'Option C'::text, 'Option D'::text, 'Option 1'::text, 'Option 2'::text, 'Option 3'::text, 'Option 4'::text]))
    AND (btrim(v.option_b) <> ALL (ARRAY['Option A'::text, 'Option B'::text, 'Option C'::text, 'Option D'::text, 'Option 1'::text, 'Option 2'::text, 'Option 3'::text, 'Option 4'::text]))
    AND (btrim(v.option_c) <> ALL (ARRAY['Option A'::text, 'Option B'::text, 'Option C'::text, 'Option D'::text, 'Option 1'::text, 'Option 2'::text, 'Option 3'::text, 'Option 4'::text]))
    AND (btrim(v.option_d) <> ALL (ARRAY['Option A'::text, 'Option B'::text, 'Option C'::text, 'Option D'::text, 'Option 1'::text, 'Option 2'::text, 'Option 3'::text, 'Option 4'::text]))
    AND (COALESCE(btrim(v.question_text), ''::text) <> ''::text
         OR '[image]'::text = v.option_a OR '[image]'::text = v.option_b
         OR '[image]'::text = v.option_c OR '[image]'::text = v.option_d
         OR v.has_images IS TRUE)
    -- Exclude font-corrupted rows: any Devanagari (U+0900..U+097F) = corruption.
    AND COALESCE(v.question_text, ''::text) !~ '[ऀ-ॿ]'::text
    AND COALESCE(v.option_a, ''::text) !~ '[ऀ-ॿ]'::text
    AND COALESCE(v.option_b, ''::text) !~ '[ऀ-ॿ]'::text
    AND COALESCE(v.option_c, ''::text) !~ '[ऀ-ॿ]'::text
    AND COALESCE(v.option_d, ''::text) !~ '[ऀ-ॿ]'::text;
