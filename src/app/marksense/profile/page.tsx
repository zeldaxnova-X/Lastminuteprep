"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Lock, ArrowRight, Loader2, RotateCcw, TrendingUp, Sparkles } from "lucide-react";
import { TopNav } from "@/components/top-nav";
import { MarksenseWordmark } from "@/components/marksense/wordmark";
import { MarksenseProfile, type ProfileResponse } from "@/components/marksense/learner-profile";
import { SignalsDetail } from "@/components/marksense/signals-detail";
import { MarksenseEvolution } from "@/components/marksense/evolution";
import { SectionTrendsChart, type TrendPoint } from "@/components/marksense/section-trends-chart";
import { ChatPanel } from "@/components/marksense/chat-panel";

interface TrendsResponse {
  locked?: boolean;
  sections: string[];
  points: TrendPoint[];
}

export default function MarksenseHubPage() {
  const [data, setData] = useState<ProfileResponse | null>(null);
  const [trends, setTrends] = useState<TrendsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([
      fetch("/api/marksense/profile").then((r) => r.json()),
      fetch("/api/marksense/trends").then((r) => r.json()).catch(() => null),
    ])
      .then(([p, t]) => {
        if (!alive) return;
        setData(p as ProfileResponse);
        setTrends(t as TrendsResponse);
      })
      .catch(() => alive && setData({ hasProfile: false }))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const [p, t] = await Promise.all([
        fetch("/api/marksense/profile", { method: "POST" }).then((r) => (r.ok ? r.json() : null)),
        fetch("/api/marksense/trends").then((r) => r.json()).catch(() => null),
      ]);
      if (p) setData(p);
      if (t) setTrends(t);
    } finally {
      setRefreshing(false);
    }
  }, []);

  const locked = !loading && data?.locked === true;
  const s = data?.signals;
  const persona = data?.profile?.persona;
  const hasTrends = (trends?.points?.length ?? 0) >= 2;

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <TopNav />

      <div className="ms-dark flex flex-1 flex-col bg-bg">
      {/* Cinematic hero band */}
      <div className="relative overflow-hidden bg-panel-dark border-b border-white/5">
        <div
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            background:
              "radial-gradient(60% 120% at 50% -10%, rgba(129,140,248,0.28), transparent 60%), radial-gradient(40% 90% at 85% 10%, rgba(240,171,252,0.16), transparent 60%)",
          }}
          aria-hidden
        />
        <div className="relative mx-auto w-full max-w-5xl px-4 pb-8 pt-10 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">
                <Sparkles className="h-3.5 w-3.5" /> Your intelligence report
              </p>
              <MarksenseWordmark as="h1" tone="white" className="mt-2 text-4xl sm:text-5xl" />
              {persona && (
                <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white ring-1 ring-white/15">
                  <Sparkles className="h-3 w-3 text-[#f0abfc]" />
                  {persona}
                </span>
              )}
            </div>
            {s && (
              <div className="flex gap-6">
                <HeroStat label="Latest" value={`${s.score.latestNet}`} sub="/ 200" />
                <HeroStat label="Best" value={`${s.score.bestNet}`} sub={`avg ${s.score.avgNet}`} />
                <HeroStat
                  label="Trend"
                  value={`${s.score.trendPerAttempt > 0 ? "+" : ""}${s.score.trendPerAttempt}`}
                  sub="per mock"
                  up={s.score.trendPerAttempt > 0}
                />
              </div>
            )}
          </div>
          {data?.profile?.headline && (
            <p className="mt-6 max-w-3xl font-report text-lg leading-snug text-white/90 sm:text-xl">
              {data.profile.headline}
            </p>
          )}
        </div>
      </div>

      <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-8 sm:px-6">
        {loading && (
          <div className="flex items-center gap-2 rounded-2xl border border-hairline bg-surface p-6 text-sm text-ink-tertiary">
            <Loader2 className="h-4 w-4 animate-spin text-gold" /> Reading your history…
          </div>
        )}

        {locked && <LockedUpsell plan={data?.plan} />}

        {!loading && !locked && data?.hasProfile && (
          <>
            {/* Refresh control */}
            <div className="flex items-center justify-between">
              <p className="text-xs text-ink-tertiary">
                Learned from {data.attemptsAnalyzed} mocks
                {data.generatedAt ? ` · updated ${new Date(data.generatedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : ""}
              </p>
              <button
                onClick={onRefresh}
                disabled={refreshing}
                className="inline-flex items-center gap-1.5 rounded-lg border border-hairline-strong px-3 py-1.5 text-xs font-semibold text-ink-secondary transition-premium hover:bg-panel disabled:opacity-60"
              >
                {refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                Refresh
              </button>
            </div>

            {/* Section progress chart */}
            {hasTrends && (
              <section className="rounded-2xl border border-hairline bg-surface p-5 shadow-soft sm:p-6">
                <SectionHead eyebrow="Progress" title="Section accuracy over time" sub="Where you are gaining ground, and where you are stuck." />
                <SectionTrendsChart points={trends!.points} />
              </section>
            )}

            {/* Evolution (net trajectory + weakpoint diff + persona journey) */}
            <MarksenseEvolution />

            {/* Chatbot */}
            <ChatPanel persona={persona ?? null} />

            {/* AI profile card (weakpoints, drills, focus plan, strengths) */}
            <MarksenseProfile controlled={{ data, loading, refreshing, onRefresh }} />

            {/* Deterministic signal detail (section mastery, tendencies) */}
            {s && <SignalsDetail signals={s} />}
          </>
        )}

        {!loading && !locked && !data?.hasProfile && (
          <div className="rounded-2xl border border-gold-bright/25 bg-surface p-6 text-center">
            <p className="text-sm font-semibold text-ink">No analysis yet</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-ink-secondary">
              Take a full mock and MarksenseAI builds your intelligence report from it.
            </p>
            <Link
              href="/test/create?mode=random_test"
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-gold-bright px-4 py-2 text-sm font-semibold text-white transition-premium hover:bg-gold"
            >
              Take a mock <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}
      </main>
      </div>
    </div>
  );
}

function SectionHead({ eyebrow, title, sub }: { eyebrow: string; title: string; sub?: string }) {
  return (
    <div className="mb-5">
      <div className="flex items-center gap-2">
        <span className="h-3.5 w-1 rounded-full bg-gradient-to-b from-[#f0abfc] to-[#818cf8]" />
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-tertiary">{eyebrow}</p>
      </div>
      <h2 className="mt-2 font-report text-xl font-medium tracking-tight text-ink sm:text-2xl">{title}</h2>
      {sub && <p className="mt-1 text-xs text-ink-tertiary">{sub}</p>}
    </div>
  );
}

function HeroStat({ label, value, sub, up }: { label: string; value: string; sub?: string; up?: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-white/40">{label}</p>
      <p className="mt-0.5 flex items-center gap-1 text-2xl font-bold tabular-nums text-white">
        {up && <TrendingUp className="h-4 w-4 text-[#86efac]" />}
        {value}
      </p>
      {sub && <p className="text-[11px] tabular-nums text-white/40">{sub}</p>}
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
          <h2 className="text-base font-bold text-ink">
            The <MarksenseWordmark /> report is a paid feature
          </h2>
          <p className="max-w-xl text-sm text-ink-secondary">
            {plan === "pro"
              ? "You have full practice and reports. Upgrade to unlock your longitudinal intelligence report: recurring weakpoints, section trends, a study chat, and a plan built from every mock."
              : "MarksenseAI studies every mock you take and builds one evolving report: recurring weakpoints, the marks you leave on the table, and a plan to close the gap."}
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
