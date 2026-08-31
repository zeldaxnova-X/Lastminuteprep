import { createSupabaseServerClient } from "@/lib/supabase/server";

export type Plan = "free" | "pro" | "mentor";

const RANK: Record<Plan, number> = { free: 0, pro: 1, mentor: 2 };

/** plan >= pro, entitled to the deterministic performance report. */
export function canSeeReport(plan: Plan): boolean {
  return RANK[plan] >= RANK.pro;
}

/** plan == mentor, entitled to the AI Mentor engine (analysis + narrative). */
export function canSeeMentor(plan: Plan): boolean {
  return RANK[plan] >= RANK.mentor;
}

export interface Viewer {
  authenticated: boolean;
  userId: string | null;
  email: string | null;
  fullName: string | null;
  avatarUrl: string | null;
  plan: Plan;
  planExpiresAt: string | null;
}

/**
 * Resolve the current viewer + plan from the session cookies. Unauthenticated
 * viewers are treated as `free`. `plan` in `profiles` is the single source of
 * truth for the paywall seam.
 */
export async function getViewer(): Promise<Viewer> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      authenticated: false,
      userId: null,
      email: null,
      fullName: null,
      avatarUrl: null,
      plan: "free",
      planExpiresAt: null,
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan, full_name, avatar_url, email, plan_expires_at")
    .eq("id", user.id)
    .maybeSingle();

  // One-time-with-expiry billing: a lapsed paid plan reverts to `free` at the
  // paywall. A NULL expiry never lapses (grandfathered plans + comps).
  let plan = (profile?.plan as Plan) ?? "free";
  const expiresAt = (profile?.plan_expires_at as string | null) ?? null;
  if (plan !== "free" && expiresAt && new Date(expiresAt).getTime() < Date.now()) {
    plan = "free";
  }

  return {
    authenticated: true,
    userId: user.id,
    email: profile?.email ?? user.email ?? null,
    fullName: profile?.full_name ?? (user.user_metadata?.full_name as string) ?? null,
    avatarUrl: profile?.avatar_url ?? (user.user_metadata?.avatar_url as string) ?? null,
    plan,
    planExpiresAt: plan !== "free" ? expiresAt : null,
  };
}

/** Convenience: just the plan (free when signed out). */
export async function getUserPlan(): Promise<Plan> {
  return (await getViewer()).plan;
}
