import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/**
 * Auth-aware server Supabase client (Server Components + Route Handlers).
 * Reads/writes the session cookies via @supabase/ssr. Anon key only, RLS
 * applies, so this client sees exactly what the signed-in user is allowed to.
 *
 * NOTE: distinct from `createServerSupabaseClient()` in supabase-server.ts,
 * which uses the SERVICE ROLE for admin/data operations and bypasses RLS.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component (read-only cookies). The session
            // refresh in middleware keeps cookies fresh, so this is safe to skip.
          }
        },
      },
    }
  );
}
