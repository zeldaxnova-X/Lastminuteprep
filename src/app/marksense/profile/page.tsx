"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Lock,
  ArrowRight,
  Loader2,
  RotateCcw,
  TrendingUp,
  Sparkles,
  LayoutGrid,
  LineChart,
  Stethoscope,
  MessageSquare,
  ShieldCheck,
} from "lucide-react";
import { TopNav } from "@/components/top-nav";
import { cn } from "@/lib/utils";
import { MarksenseWordmark } from "@/components/marksense/wordmark";
import { type ProfileResponse } from "@/components/marksense/learner-profile";
import { SignalsDetail } from "@/components/marksense/signals-detail";
import { MarksenseEvolution } from "@/components/marksense/evolution";
import { SectionTrendsChart, type TrendPoint } from "@/components/marksense/section-trends-chart";
import { ChatPanel } from "@/components/marksense/chat-panel";
import { WeakpointCard } from "@/components/marksense/weakpoint-card";

interface TrendsResponse {
  locked?: boolean;
  sections: string[];
  points: TrendPoint[];
}

type Tab = "overview" | "progress" | "diagnosis" | "coach";
const TABS: Array<{ id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: "overview", label: "Overview", icon: LayoutGrid },
  { id: "progress", label: "Progress", icon: LineChart },
  { id: "diagnosis", label: "Diagnosis", icon: Stethoscope },
  { id: "coach", label: "Coach", icon: MessageSquare },
];

export default function MarksenseHubPage() {
  const [data, setData] = useState<ProfileResponse | null>(null);
  const [trends, setTrends] = useState<TrendsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<Tab>("overview");

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
  const p = data?.profile;
  const persona = p?.persona;
  const hasTrends = (trends?.points?.length ?? 0) >= 2;
  const ready = !loading && !locked && data?.hasProfile && !!s;

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <TopNav />

      <div className="ms-dark flex flex-1 flex-col bg-bg">
        {/* Hero: the at-a-glance summary */}
        <div className="relative overflow-hidden border-b border-white/5 bg-panel-dark">
          <div
            className="pointer-events-none absolute inset-0 opacity-70"
            style={{
              background:
                "radial-gradient(60% 120% at 50% -10%, rgba(129,140,248,0.28), transparent 60%), radial-gradient(40% 90% at 85% 10%, rgba(240,171,252,0.16), transparent 60%)",
            }}
            aria-hidden
          />
          <div className="relative mx-auto w-full max-w-5xl px-4 pb-6 pt-9 sm:px-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">
                  <Sparkles className="h-3.5 w-3.5" /> Your intelligence report
                </p>
                <MarksenseWordmark as="h1" tone="white" className="mt-2 text-3xl sm:text-4xl" />
                {persona && (
                  <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white ring-1 ring-white/15">
                    <Sparkles className="h-3 w-3 text-[#f0abfc]" />
                    {persona}
                  </span>
                )}
              </div>
              {s && (
                <div className="grid grid-cols-4 gap-x-5 gap-y-2 sm:gap-x-7">
                  <HeroStat label="Latest" value={`${s.score.latestNet}`} sub="/ 200" />
                  <HeroStat label="Best" value={`${s.score.bestNet}`} sub={`avg ${s.score.avgNet}`} />
                  <HeroStat
                    label="Trend"
                    value={`${s.score.trendPerAttempt > 0 ? "+" : ""}${s.score.trendPerAttempt}`}
                    sub="per mock"
                    up={s.score.trendPerAttempt > 0}
                  />
                  {p && p.projectedGain > 0 && (
                    <HeroStat label="Reachable" value={`+${p.projectedGain}`} sub="marks" up />
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Sticky tab bar */}
          {ready && (
            <div className="relative mx-auto w-full max-w-5xl px-4 sm:px-6">
              <div className="flex gap-1 overflow-x-auto">
                {TABS.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={cn(
                      "flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3.5 py-2.5 text-sm font-semibold transition-premium",
                      tab === t.id
                        ? "border-[#c084fc] text-white"
                        : "border-transparent text-white/45 hover:text-white/80"
                    )}
                  >
                    <t.icon className="h-4 w-4" />
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-7 sm:px-6">
          {loading && (
            <div className="flex items-center gap-2 rounded-2xl border border-hairline bg-surface p-6 text-sm text-ink-tertiary">
              <Loader2 className="h-4 w-4 animate-spin text-gold" /> Reading your history…
            </div>
          )}

          {locked && <LockedUpsell plan={data?.plan} />}

          {ready && (
            <>
              {/* meta row */}
              <div className="mb-5 flex items-center justify-between">
                <p className="text-xs text-ink-tertiary">
                  Learned from {data!.attemptsAnalyzed} mocks
                  {data!.generatedAt ? ` · updated ${new Date(data!.generatedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : ""}
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

              {tab === "overview" && (
                <OverviewTab data={data!} onAskCoach={() => setTab("coach")} onSeeAll={() => setTab("diagnosis")} />
              )}

              {tab === "progress" && (
                <div className="space-y-6">
                  {hasTrends && (
                    <section className="rounded-2xl border border-hairline bg-surface p-5 shadow-soft sm:p-6">
                      <SectionHead eyebrow="Progress" title="Section accuracy over time" sub="Where you are gaining ground, and where you are stuck." />
                      <SectionTrendsChart points={trends!.points} />
                    </section>
                  )}
                  <MarksenseEvolution />
                </div>
              )}

              {tab === "diagnosis" && (
                <div className="space-y-6">
                  {p?.weakpoints?.length ? (
                    <section className="rounded-2xl border border-hairline bg-surface p-5 shadow-soft sm:p-6">
                      <SectionHead eyebrow="Diagnosis" title="Weakpoints, most costly first" sub="Ranked by the marks they cost you." />
                      <div className="space-y-2.5">
                        {p.weakpoints.map((w, i) => (
                          <WeakpointCard key={`${w.area}-${i}`} w={w} />
                        ))}
                      </div>
                    </section>
                  ) : null}
                  <SignalsDetail signals={s!} hideScoreJourney />
                </div>
              )}

              {tab === "coach" && <ChatPanel persona={persona ?? null} />}
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

/* ---------------- Overview: the "what do I do now" view ---------------- */
function OverviewTab({
  data,
  onAskCoach,
  onSeeAll,
}: {
  data: ProfileResponse;
  onAskCoach: () => void;
  onSeeAll: () => void;
}) {
  const p = data.profile;
  const top = p?.weakpoints?.slice(0, 3) ?? [];
  return (
    <div className="space-y-6">
      {/* Verdict */}
      {(p?.headline || p?.trajectory) && (
        <section className="rounded-2xl border border-hairline bg-surface p-5 shadow-soft sm:p-6">
          {p?.headline && <p className="font-report text-lg leading-snug text-ink sm:text-xl">{p.headline}</p>}
          {p?.trajectory && <p className="mt-2 text-sm leading-relaxed text-ink-secondary">{p.trajectory}</p>}
          {p?.strengths?.length ? (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-success">
                <ShieldCheck className="h-3.5 w-3.5" /> Strengths
              </span>
              {p.strengths.map((str) => (
                <span key={str} className="rounded-full bg-success/10 px-2.5 py-1 text-xs text-success ring-1 ring-success/20">
                  {str}
                </span>
              ))}
            </div>
          ) : null}
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Focus plan */}
        {p?.focusPlan?.length ? (
          <section className="rounded-2xl border border-hairline bg-surface p-5 shadow-soft sm:p-6 lg:col-span-3">
            <SectionHead eyebrow="Do this week" title="Your focus plan" />
            <ol className="space-y-3">
              {p.focusPlan.map((step, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-ink-secondary">
                  <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-gold-soft text-xs font-bold text-gold">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        {/* Coach CTA */}
        <section className="flex flex-col justify-between rounded-2xl border border-gold-bright/25 bg-gradient-to-br from-gold-soft/40 to-surface p-5 shadow-soft sm:p-6 lg:col-span-2">
          <div>
            <SectionHead eyebrow="Ask" title="Your study coach" />
            <p className="text-sm text-ink-secondary">
              Stuck on a topic, or want a plan for the weeks ahead? Ask your coach, it knows your last mocks.
            </p>
          </div>
          <button
            onClick={onAskCoach}
            className="mt-4 inline-flex items-center justify-center gap-2 rounded-lg bg-gold-bright px-4 py-2.5 text-sm font-semibold text-white transition-premium hover:bg-gold"
          >
            <MessageSquare className="h-4 w-4" /> Open the coach
          </button>
        </section>
      </div>

      {/* Top weakpoints */}
      {top.length > 0 && (
        <section className="rounded-2xl border border-hairline bg-surface p-5 shadow-soft sm:p-6">
          <div className="mb-5 flex items-end justify-between">
            <SectionHead eyebrow="Fix first" title="Your top weakpoints" />
            <button onClick={onSeeAll} className="mb-1 inline-flex items-center gap-1 text-xs font-semibold text-gold">
              See all <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="space-y-2.5">
            {top.map((w, i) => (
              <WeakpointCard key={`${w.area}-${i}`} w={w} />
            ))}
          </div>
        </section>
      )}
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
      <p className="mt-0.5 flex items-center gap-1 text-xl font-bold tabular-nums text-white sm:text-2xl">
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
              ? "You have full practice and reports. Upgrade to unlock your longitudinal intelligence report: recurring weakpoints, section trends, a study coach, and a plan built from every mock."
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
