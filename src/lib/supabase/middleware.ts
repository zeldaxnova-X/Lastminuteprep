import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

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
  /^\/admin(\/|$)/,
  /^\/test\/create(\/|$)/,
  /^\/test\/[^/]+\/mentor(\/|$)/,
];

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
  // and getUser() — it can log users out at random.
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
