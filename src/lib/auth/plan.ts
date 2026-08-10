import { createSupabaseServerClient } from "@/lib/supabase/server";

export type Plan = "free" | "pro" | "mentor";

const RANK: Record<Plan, number> = { free: 0, pro: 1, mentor: 2 };

/** plan >= pro — entitled to the deterministic performance report. */
export function canSeeReport(plan: Plan): boolean {
  return RANK[plan] >= RANK.pro;
}

/** plan == mentor — entitled to the AI Mentor engine (analysis + narrative). */
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
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan, full_name, avatar_url, email")
    .eq("id", user.id)
    .maybeSingle();

  const plan = (profile?.plan as Plan) ?? "free";
  return {
    authenticated: true,
    userId: user.id,
    email: profile?.email ?? user.email ?? null,
    fullName: profile?.full_name ?? (user.user_metadata?.full_name as string) ?? null,
    avatarUrl: profile?.avatar_url ?? (user.user_metadata?.avatar_url as string) ?? null,
    plan,
  };
}

/** Convenience: just the plan (free when signed out). */
export async function getUserPlan(): Promise<Plan> {
  return (await getViewer()).plan;
}
