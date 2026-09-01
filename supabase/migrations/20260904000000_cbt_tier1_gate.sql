-- ----------------------------------------------------------------------------
-- Gate CBT question selection to Tier 1.
--
-- Recovered Tier-2 questions live in `questions`/`papers` (tier = 'Tier 2') but
-- must never enter Tier-1 mocks, subject tests, or PYP pulls. cbt_valid_questions
-- is the single source the CBT engine selects from (via cbt_pick_unique_questions
-- and coverage), so we add a Tier-1 filter here. Output columns are unchanged, so
-- the cbt_pick_unique_questions RETURNS SETOF dependency stays valid (no drop).
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
  WHERE p.tier = 'Tier 1'
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
         OR v.has_images IS TRUE);
