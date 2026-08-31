import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { safeNext } from "@/lib/auth/next";

/**
 * Route prefixes that require an authenticated account. Anonymous visitors are
 * redirected to /login. The public try-the-sample flow (`/sample` and the
 * `/test/<id>` runner it launches) is intentionally NOT listed so the one-time
 * anonymous sample keeps working; premium areas (dashboard, analytics, the AI
 * Mentor, etc.) are. Plan-level gating (Pro/Mentor) is enforced separately in
 * the pages/APIs via `getViewer()`.
 */
const PROTECTED_PATTERNS: RegExp[] = [
  /^\/dashboard(\/|$)/,
  /^\/analytics(\/|$)/,
  /^\/revision(\/|$)/,
  /^\/bookmarks(\/|$)/,
  /^\/test\/create(\/|$)/,
  /^\/test\/[^/]+\/mentor(\/|$)/,
];
// NOTE: /admin is intentionally NOT redirected here. It is gated in
// src/app/admin/layout.tsx, which returns 404 for anyone who isn't an admin
// (signed-out included) so the admin area's existence is never revealed.

function isProtected(pathname: string): boolean {
  return PROTECTED_PATTERNS.some((re) => re.test(pathname));
}

/**
 * Session-refresh + route-gate middleware helper. Runs on every request to keep
 * the auth cookies fresh (Supabase tokens rotate) AND to bounce unauthenticated
 * visitors away from protected areas to /login (with a ?next= return path).
 * Centralising the gate here means it cannot be bypassed by client-side
 * navigation to a route whose page never checked auth.
 */
export async function updateSession(request: NextRequest) {
  // OAuth code safety net: Supabase falls back to the project's Site URL (often
  // the root "/") when the `redirectTo` isn't allow-listed, stranding the `?code`
  // there so it's never exchanged. Forward any stray code to /auth/callback (the
  // PKCE exchange happens there), preserving ?next. The code-verifier cookie is
  // same-origin, so it rides along. The proper fix is still to allow-list
  // /auth/callback in the Supabase dashboard, this just prevents a dead end.
  {
    const { pathname, searchParams } = request.nextUrl;
    if (pathname !== "/auth/callback" && searchParams.has("code")) {
      const url = request.nextUrl.clone();
      const code = searchParams.get("code")!;
      const next = safeNext(searchParams.get("next"));
      url.pathname = "/auth/callback";
      url.search = "";
      url.searchParams.set("code", code);
      url.searchParams.set("next", next);
      return NextResponse.redirect(url);
    }
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: refresh the token. Do not run logic between createServerClient
  // and getUser(), it can log users out at random.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Gate protected areas: unauthenticated visitors are redirected to /login
  // with a return path. This closes the bypass where a signed-out user could
  // reach the dashboard / Mentor directly (e.g. via "Go to dashboard").
  const { pathname, search } = request.nextUrl;
  if (!user && isProtected(pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    loginUrl.searchParams.set("next", pathname + search);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}
