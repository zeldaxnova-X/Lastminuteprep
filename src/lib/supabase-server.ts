import { createClient } from "@supabase/supabase-js";

/**
 * Server-side Supabase client for API routes.
 * Uses the service role key for admin operations (bypasses RLS).
 * NEVER expose this client to the browser.
 */
export function createServerSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not configured.");
  }

  // FAIL LOUD. This is the SERVICE-ROLE (RLS-bypassing) client. Silently falling
  // back to the anon key, as this function used to, turns a missing/wrong key
  // into a confusing "new row violates row-level security policy" at write time
  // (it broke the anonymous sample: the "service" client was actually anon, so
  // RLS refused the insert). Refuse to construct a non-service client here so
  // the misconfiguration is obvious and catchable, not a red-herring RLS error.
  if (!serviceKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. The service-role client needs the SECRET key; " +
        "refusing to fall back to the anon key (that silently breaks RLS-protected writes " +
        "like the anonymous sample)."
    );
  }
  if (
    serviceKey.startsWith("sb_publishable_") ||
    serviceKey === process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY looks like a publishable/anon key. Service-role operations " +
        "require the SECRET key (sb_secret_… or the service_role JWT). Fix this env var in the " +
        "deployment (this misconfiguration surfaces as an RLS violation on anonymous inserts)."
    );
  }

  return createClient(supabaseUrl, serviceKey, {
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
