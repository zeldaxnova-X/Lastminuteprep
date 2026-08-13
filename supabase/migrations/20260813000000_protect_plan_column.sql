-- ============================================================================
-- Migration 20260813000000: Protect privileged profile columns (plan, is_admin)
-- from client self-service.
--
-- Gap being closed: `profiles_update_own` (M9) lets a signed-in user UPDATE any
-- column of their own row — RLS can't restrict columns — so a user could set
-- `plan = 'mentor'` (or `is_admin = true`) directly via the anon client and
-- bypass payment / the admin grant entirely.
--
-- Fix: a BEFORE UPDATE trigger that rejects any change to `plan`/`is_admin`
-- UNLESS the caller is privileged — i.e. the PostgREST service role, or a
-- direct/superuser DB session (migrations, admin scripts) which carries no JWT
-- claims. Ordinary authenticated/anon requests are blocked.
-- ============================================================================
BEGIN;

CREATE OR REPLACE FUNCTION public.guard_profile_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  claims   text := current_setting('request.jwt.claims', true);
  jwt_role text;
BEGIN
  -- PostgREST exposes the caller's JWT role. It is NULL for a direct/superuser
  -- DB session (no request context), 'service_role' for the service key, and
  -- 'authenticated'/'anon' for client requests.
  IF claims IS NOT NULL AND claims <> '' THEN
    jwt_role := claims::json ->> 'role';
  END IF;
  IF jwt_role IS NULL THEN
    jwt_role := current_setting('request.jwt.claim.role', true);
  END IF;

  IF (NEW.plan IS DISTINCT FROM OLD.plan
      OR NEW.is_admin IS DISTINCT FROM OLD.is_admin)
     AND jwt_role IS NOT NULL
     AND jwt_role <> 'service_role' THEN
    RAISE EXCEPTION
      'profiles.plan / profiles.is_admin can only be changed server-side (attempted by role %).',
      jwt_role
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_profile_privileged_columns ON public.profiles;
CREATE TRIGGER trg_guard_profile_privileged_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_profile_privileged_columns();

COMMIT;
