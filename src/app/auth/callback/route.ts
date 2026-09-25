import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/auth/next";
import { claimAnonymousAttempts } from "@/lib/auth/api-guard";

/**
 * GET /auth/callback, OAuth (Google) + email-confirmation redirect target.
 * Exchanges the `code` for a session (cookies), then returns the user to
 * `next` (same-origin only). Configure this URL in the Supabase dashboard as
 * an allowed redirect: <site>/auth/callback.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Critical funnel step: atomically attach any anonymous mock taken on this
      // device to the new session BEFORE we redirect to the report, so it's owned
      // by the time the report page loads (no race, survives a fresh tab).
      const userId = data?.user?.id;
      if (userId) {
        try {
          await claimAnonymousAttempts(userId);
        } catch {
          /* /api/auth/me is an idempotent backstop if this ever fails */
        }
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=oauth&next=${encodeURIComponent(next)}`);
}
