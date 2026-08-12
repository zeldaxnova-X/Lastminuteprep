-- ============================================================================
-- Migration 20260810000001: Grant admin by USER ID — credential-free.
--
-- This migration contains NO email, password, or user id. It reads the target
-- user id from a runtime Postgres setting `app.admin_user_id`, which YOU supply
-- when applying it (see supabase/ADMIN_SETUP.md). If the setting is absent it is
-- a safe no-op, so committing this file never grants anyone admin.
--
-- Apply with the id set for the duration of the statement, e.g.:
--   psql "$DATABASE_URL" -c "SET app.admin_user_id = '<uuid>'; \i supabase/migrations/20260810000001_grant_admin.sql"
-- or via the project's runner:  npm run admin:grant   (reads $ADMIN_USER_ID)
-- ============================================================================
BEGIN;

DO $$
DECLARE
  aid text := current_setting('app.admin_user_id', true);
BEGIN
  IF aid IS NULL OR aid = '' THEN
    RAISE NOTICE 'app.admin_user_id not set — no admin granted (safe no-op).';
    RETURN;
  END IF;

  UPDATE public.profiles SET is_admin = true, updated_at = now() WHERE id = aid::uuid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No profile with id % — create the user in the Supabase dashboard first, then re-run.', aid;
  END IF;

  RAISE NOTICE 'Granted admin to %.', aid;
END $$;

COMMIT;
