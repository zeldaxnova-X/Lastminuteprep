import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Session-refresh middleware helper. Runs on every request to keep the auth
 * cookies fresh (Supabase tokens rotate). Does NOT gate routes — page/route
 * level checks own that — it only refreshes the session so server components
 * and API routes read a valid `auth.uid()`.
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
  await supabase.auth.getUser();

  return response;
}
