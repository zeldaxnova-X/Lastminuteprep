-- Migration: Allow dev/anon access for CBT Engine tables during testing & client usage

DROP POLICY IF EXISTS "Dev insert on exam_attempts" ON public.exam_attempts;
CREATE POLICY "Dev insert on exam_attempts"
    ON public.exam_attempts FOR ALL
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Dev insert on attempt_answers" ON public.attempt_answers;
CREATE POLICY "Dev insert on attempt_answers"
    ON public.attempt_answers FOR ALL
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Dev insert on user_bookmarks" ON public.user_bookmarks;
CREATE POLICY "Dev insert on user_bookmarks"
    ON public.user_bookmarks FOR ALL
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Dev insert on user_analytics" ON public.user_analytics;
CREATE POLICY "Dev insert on user_analytics"
    ON public.user_analytics FOR ALL
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);
