# Admin provisioning (credential-free)

Admin rights are granted **by user id**, never by credentials. No email,
password, or real user id is committed anywhere in this repo.

## Steps (do these locally; commit nothing)

1. **Create the admin user yourself** in the Supabase dashboard:
   Authentication → Users → **Add user** → your email + a strong password.
   (The password never touches the codebase.)

2. **Copy that user's UUID** from the dashboard (the `id` column).

3. **Apply the schema migrations** (adds `profiles.is_admin`, RLS, the
   `is_admin()` helper). These contain no ids:
   ```bash
   npx supabase db push --linked
   ```

4. **Grant admin to your id** — pick ONE, both keep the id out of git:

   **A) One-off runner (reads `ADMIN_USER_ID` from your shell/.env.local):**
   ```bash
   ADMIN_USER_ID=<your-user-uuid> npm run admin:grant
   ```

   **B) Run the grant migration with the id as a runtime setting:**
   ```bash
   psql "$DATABASE_URL" \
     -c "SET app.admin_user_id = '<your-user-uuid>'; \i supabase/migrations/20260810000001_grant_admin.sql"
   ```

## What was chosen and why
- **Schema** (`is_admin` column, RLS, `is_admin()` helper) lives in a committed
  migration — safe, contains no identity.
- **The grant** takes the id from a **runtime input** (`ADMIN_USER_ID` env for
  the runner, or the `app.admin_user_id` Postgres setting for the migration).
  The committed `20260810000001_grant_admin.sql` reads `current_setting(...)`
  and is a **safe no-op if unset**, so committing it never grants anyone admin.

## Verify
- `/admin/*` returns **404** for signed-out users and for signed-in non-admins
  (server gate in `src/app/admin/layout.tsx`), and only renders for `is_admin`.
- Admin/staging tables are RLS-locked to `is_admin()` at the database.
- To confirm your grant: sign in as the admin user and open `/admin/upload`.

Never commit `.env.local`, `ADMIN_USER_ID`, or any password.
