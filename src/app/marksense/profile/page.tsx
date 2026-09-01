"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles, Lock, ArrowRight, Loader2 } from "lucide-react";
import { TopNav } from "@/components/top-nav";
import { MarksenseProfile, type ProfileResponse } from "@/components/marksense/learner-profile";
import { SignalsDetail } from "@/components/marksense/signals-detail";

/**
 * Dedicated MarksenseAI profile page. Owns a single fetch so the AI card and the
 * deterministic signal detail render from one request (no double regeneration).
 * Non-mentor visitors get a focused upsell instead of the profile.
 */
export default function MarksenseProfilePage() {
  const [data, setData] = useState<ProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/marksense/profile")
      .then((r) => r.json())
      .then((d: ProfileResponse) => alive && setData(d))
      .catch(() => alive && setData({ hasProfile: false }))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const r = await fetch("/api/marksense/profile", { method: "POST" });
      if (r.ok) setData(await r.json());
    } catch {
      /* keep prior view */
    } finally {
      setRefreshing(false);
    }
  }, []);

  const locked = !loading && data?.locked === true;

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <TopNav />
      <main className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-4 py-10 sm:px-6">
        {/* Header */}
        <div className="space-y-1.5">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gold">
            <Sparkles className="h-3.5 w-3.5" /> MarksenseAI
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            Your learner profile
          </h1>
          <p className="max-w-2xl text-sm text-ink-secondary">
            A living read of how you perform across every mock, not just the last one. The more you
            practise, the sharper it gets.
          </p>
        </div>

        {loading && (
          <div className="flex items-center gap-2 rounded-2xl border border-hairline bg-surface p-6 text-sm text-ink-tertiary">
            <Loader2 className="h-4 w-4 animate-spin text-gold" /> Loading your profile…
          </div>
        )}

        {locked && <LockedUpsell plan={data?.plan} />}

        {!loading && !locked && (
          <>
            <MarksenseProfile controlled={{ data, loading, refreshing, onRefresh }} />
            {data?.signals && <SignalsDetail signals={data.signals} />}
          </>
        )}
      </main>
    </div>
  );
}

function LockedUpsell({ plan }: { plan?: string }) {
  return (
    <div className="rounded-2xl border border-gold-bright/30 bg-gradient-to-br from-gold-soft/60 to-surface p-6 shadow-soft">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gold-bright/15 text-gold ring-1 ring-gold-bright/30">
          <Lock className="h-5 w-5" />
        </span>
        <div className="space-y-1">
          <h2 className="text-base font-bold text-ink">The learner profile is a MarksenseAI feature</h2>
          <p className="max-w-xl text-sm text-ink-secondary">
            {plan === "pro"
              ? "You have full practice and reports. Upgrade to MarksenseAI to unlock your longitudinal profile: recurring weakpoints, targeted drills, and a week-by-week focus plan built from every mock you take."
              : "MarksenseAI studies every mock you take and builds one evolving profile: your recurring weakpoints, the marks you leave on the table, and a plan to close the gap."}
          </p>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap gap-3">
        <Link
          href="/dashboard?checkout=mentor:monthly"
          className="inline-flex items-center gap-2 rounded-lg bg-gold-bright px-4 py-2.5 text-sm font-semibold text-white transition-premium hover:bg-gold"
        >
          <Sparkles className="h-4 w-4" /> Unlock MarksenseAI, ₹99
        </Link>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 rounded-lg border border-hairline-strong px-4 py-2.5 text-sm font-semibold text-ink-secondary transition-premium hover:bg-panel"
        >
          Back to dashboard <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
