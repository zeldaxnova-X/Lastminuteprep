import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

/**
 * Server-side identity + authorization helpers for API routes.
 *
 * The golden rule: identity comes from the Supabase SESSION (auth.uid()),
 * derived server-side, never from a stub, header, query param, or body field
 * the client controls. Row-scoped reads/writes for a signed-in user go through
 * the USER-SCOPED client so Postgres RLS enforces ownership as a backstop; the
 * service-role client is used only for anonymous-sample writes and reference
 * data, always with explicit checks in code.
 */

/** Durable, httpOnly device token cookie for the anonymous one-time sample. */
export const DEVICE_COOKIE = "lmp_device";
const DEVICE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

export const json401 = () =>
  NextResponse.json({ error: "Authentication required." }, { status: 401 });
/** Prefer 404 for row-scoped mismatches so we don't confirm the id exists. */
export const json404 = () => NextResponse.json({ error: "Not found." }, { status: 404 });
export const json403 = () => NextResponse.json({ error: "Forbidden." }, { status: 403 });

/**
 * The authenticated user (from the session) plus a USER-SCOPED Supabase client
 * (RLS-enforced). `user` is null when signed out.
 */
export async function getSessionContext(): Promise<{
  user: User | null;
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
}> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { user, supabase };
}

/** Convenience: just the authenticated user id, or null. */
export async function getUserId(): Promise<string | null> {
  const { user } = await getSessionContext();
  return user?.id ?? null;
}

/** Read the device token from the request cookies (null if absent). */
export async function readDeviceToken(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(DEVICE_COOKIE)?.value ?? null;
}

/**
 * Attach a freshly-minted device token to a response as an httpOnly cookie.
 * Call after generating a token for a first-time anonymous sampler.
 */
export function setDeviceCookie(res: NextResponse, token: string): NextResponse {
  res.cookies.set(DEVICE_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DEVICE_COOKIE_MAX_AGE,
  });
  return res;
}

/** True when the signed-in user is an admin (profiles.is_admin). */
export async function isAdmin(): Promise<boolean> {
  const { user, supabase } = await getSessionContext();
  if (!user) return false;
  const { data } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();
  return data?.is_admin === true;
}

/** The service-role client, RLS-bypassing. Use ONLY for anonymous-sample
 *  writes and reference data, never to sidestep an ownership check. */
export function serviceClient() {
  return createServerSupabaseClient();
}

/**
 * SINGLE SOURCE OF TRUTH for which Supabase client an `exam_attempts` WRITE
 * (create / update / delete) must use, chosen by identity. No route may pick
 * this ad hoc, this exact decision has regressed TWICE, each time an identity
 * refactor moved a route onto the cookie client and RLS then refused the
 * anonymous sample insert ("new row violates row-level security policy").
 *
 *   • authenticated (sessionUserId set) → USER-SCOPED client: Postgres RLS
 *     stamps + enforces user_id = auth.uid() (own-row WITH CHECK).
 *   • anonymous sample (sessionUserId null) → SERVICE-ROLE client: there is NO
 *     session for RLS to key on, so the row (user_id NULL + device_id) is
 *     written via the service role and guarded by the device-token check in
 *     code. This is the DOCUMENTED RLS exception, do NOT switch it to the
 *     cookie client; RLS would reject the anon insert.
 *
 * Mirrors loadOwnedAttempt's read-side client contract.
 */
export async function attemptWriteClient(
  sessionUserId: string | null
): Promise<SupabaseClient> {
  return sessionUserId
    ? ((await createSupabaseServerClient()) as unknown as SupabaseClient)
    : (serviceClient() as unknown as SupabaseClient);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Attempt rows are dynamic Supabase shapes; callers read many columns.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AttemptRow = Record<string, any>;

/**
 * Load an exam attempt the caller is entitled to, or return an error response.
 *
 * The client returned in `db` is chosen HERE, by ownership kind, so callers
 * never decide which client to trust:
 *   • Authenticated owner (attempt.user_id set) → the USER-SCOPED client, so
 *     Postgres RLS is an ACTIVE backstop on every subsequent read/write the
 *     route performs (defence in depth behind this code check).
 *   • Anonymous sample (attempt.user_id NULL) → the SERVICE-ROLE client, gated
 *     by the httpOnly device token matched in code. Documented exception: an
 *     anonymous sampler has no session for RLS to key on, so the code check is
 *     the sole enforcement on that path.
 *
 * The ownership-determining SELECT uses the service role so we can read
 * user_id / device_id regardless of RLS; ownership is then proven before the
 * row (and the appropriate client) is handed back. Any mismatch → 404 (never
 * confirms the id exists). `isSample` lets callers branch when they must.
 */
export async function loadOwnedAttempt(
  attemptId: string
): Promise<
  | { ok: true; attempt: AttemptRow; db: SupabaseClient; isSample: boolean }
  | { ok: false; res: NextResponse }
> {
  if (!UUID_RE.test(attemptId)) return { ok: false, res: json404() };
  const svc = serviceClient();
  const { data: attempt } = await svc
    .from("exam_attempts")
    .select("*")
    .eq("id", attemptId)
    .maybeSingle();
  if (!attempt) return { ok: false, res: json404() };

  if (attempt.user_id) {
    // Authenticated-owner path → user-scoped client (RLS live).
    const { user, supabase } = await getSessionContext();
    if (!user) return { ok: false, res: json401() };
    if (user.id !== attempt.user_id) return { ok: false, res: json404() };
    return {
      ok: true,
      attempt: attempt as AttemptRow,
      db: supabase as unknown as SupabaseClient,
      isSample: false,
    };
  }

  // Anonymous-sample path → service-role + explicit device-token check.
  const token = await readDeviceToken();
  if (!token || !attempt.device_id || token !== attempt.device_id) {
    return { ok: false, res: json404() };
  }
  return {
    ok: true,
    attempt: attempt as AttemptRow,
    db: svc as unknown as SupabaseClient,
    isSample: true,
  };
}

/**
 * When a signed-in user has an unclaimed anonymous sample on this device, attach
 * it to their account so their sample result follows them in. Idempotent.
 */
export async function claimSampleForUser(userId: string): Promise<void> {
  const token = await readDeviceToken();
  if (!token) return;
  const svc = serviceClient();
  const { data: sample } = await svc
    .from("sample_attempts")
    .select("device_token, attempt_id, claimed_by")
    .eq("device_token", token)
    .maybeSingle();
  if (!sample || sample.claimed_by) return;

  await svc
    .from("sample_attempts")
    .update({ claimed_by: userId, claimed_at: new Date().toISOString() })
    .eq("device_token", token);
  if (sample.attempt_id) {
    await svc
      .from("exam_attempts")
      .update({ user_id: userId, device_id: null })
      .eq("id", sample.attempt_id);
  }
}
