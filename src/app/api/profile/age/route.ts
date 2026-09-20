import { NextResponse } from "next/server";
import { getSessionContext, json401 } from "@/lib/auth/api-guard";

/**
 * POST /api/profile/age
 * Records the signed-in user's 18+ confirmation on their profile (age gate, E4).
 * Idempotent, only sets the timestamp if not already set. The affirmative act
 * happened at signup (a required checkbox); this persists it to the account.
 */
export async function POST() {
  const { user, supabase } = await getSessionContext();
  if (!user) return json401();
  const { data: profile } = await supabase
    .from("profiles")
    .select("age_confirmed_at")
    .eq("id", user.id)
    .maybeSingle();
  if (profile && !profile.age_confirmed_at) {
    await supabase
      .from("profiles")
      .update({ age_confirmed_at: new Date().toISOString() })
      .eq("id", user.id);
  }
  return NextResponse.json({ ok: true });
}
