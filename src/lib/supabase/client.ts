import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser Supabase client (cookie-based session via @supabase/ssr).
 * Anon/publishable key ONLY — never the service role. This is the canonical
 * auth client for client components (login, account menu, sign-out).
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
