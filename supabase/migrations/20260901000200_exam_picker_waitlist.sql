-- ----------------------------------------------------------------------------
-- Exam picker + per-exam notify-me waitlist.
--
-- `profiles.selected_exam` records which exam the user is preparing for (their
-- primary), so the dashboard can tailor copy and we only ask once. Picking a
-- not-yet-live exam also drops a row in `exam_waitlist` to build a launch list.
-- ----------------------------------------------------------------------------
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS selected_exam text;

CREATE TABLE IF NOT EXISTS public.exam_waitlist (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    exam_slug  text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, exam_slug)
);

CREATE INDEX IF NOT EXISTS idx_exam_waitlist_slug ON public.exam_waitlist(exam_slug);

ALTER TABLE public.exam_waitlist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read own waitlist" ON public.exam_waitlist;
CREATE POLICY "read own waitlist" ON public.exam_waitlist
    FOR SELECT USING (auth.uid() = user_id);
