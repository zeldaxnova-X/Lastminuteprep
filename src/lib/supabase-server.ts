import { createClient } from "@supabase/supabase-js";

/**
 * Server-side Supabase client for API routes.
 * Uses the service role key for admin operations (bypasses RLS).
 * NEVER expose this client to the browser.
 */
export function createServerSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://aiddngocebksoudlrvoh.supabase.co";
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  // If no service role key, fall back to anon key (with RLS enforced)
  const key = supabaseServiceKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_XwMkcgE8AXWvrPaXsRU_Tw_UlhaT7dI";

  return createClient(supabaseUrl, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Creates a Supabase client scoped to a specific user's auth token.
 * Used in API routes to enforce RLS for the authenticated user.
 */
export function createUserSupabaseClient(accessToken: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://aiddngocebksoudlrvoh.supabase.co";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_XwMkcgE8AXWvrPaXsRU_Tw_UlhaT7dI";

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
