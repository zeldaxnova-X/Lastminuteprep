-- ----------------------------------------------------------------------------
-- Paper-level publish gate.
--
-- Adds papers.published (default true) so an entire paper can be held out of
-- the live CBT pool while it is still being fixed, without deleting its data.
-- 21-July-2023 Shift-1 is held back: 54 of its 100 questions are font-corrupted
-- and its only source is the Hindi paper (recovery needs translation), so the
-- whole paper stays in the DB but out of production until resolved.
--
-- cbt_valid_questions gains `AND p.published` so unpublished papers vanish from
-- the pool; re-publishing is a one-row UPDATE.
-- ----------------------------------------------------------------------------
ALTER TABLE public.papers ADD COLUMN IF NOT EXISTS published boolean NOT NULL DEFAULT true;

UPDATE public.papers SET published = false
  WHERE paper_id = 'ssc-cgl-tier-1-2023-2023-07-21-shift-1';

CREATE OR REPLACE VIEW public.cbt_valid_questions AS
 SELECT v.id, v.paper_id, v.paper_name, v.year, v.shift, v.subject,
    v.question_number, v.question_text, v.question_image,
    v.option_a, v.option_b, v.option_c, v.option_d,
    v.correct_answer, v.official_explanation, v.marks, v.negative_marks,
    v.source_pdf, v.dataset_version, v.section_slug, v.has_images
   FROM validated_questions v
     JOIN papers p ON p.paper_id = v.paper_id
  WHERE p.tier = 'Tier 1'::text
    AND p.published
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
    AND COALESCE(v.question_text, ''::text) !~ '[ऀ-ॿ]'::text
    AND COALESCE(v.option_a, ''::text) !~ '[ऀ-ॿ]'::text
    AND COALESCE(v.option_b, ''::text) !~ '[ऀ-ॿ]'::text
    AND COALESCE(v.option_c, ''::text) !~ '[ऀ-ॿ]'::text
    AND COALESCE(v.option_d, ''::text) !~ '[ऀ-ॿ]'::text;
