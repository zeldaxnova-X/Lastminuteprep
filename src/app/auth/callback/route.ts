import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/auth/next";

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
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=oauth&next=${encodeURIComponent(next)}`);
}
