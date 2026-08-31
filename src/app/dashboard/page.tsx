"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useTestStore } from "@/lib/store/use-test-store";
import { TopNav } from "@/components/top-nav";
import { RazorpayBadge } from "@/components/payments/razorpay-badge";
import { Card } from "@/components/ui/card";
import { StatTile } from "@/components/ui/stat-tile";
import { ButtonLink } from "@/components/ui/button";
import { sectionLabel } from "@/lib/cbt-questions";
import { startRazorpayCheckout, waitForPlanUpgrade } from "@/lib/payments/razorpay-checkout";
import { cn } from "@/lib/utils";
import {
  BookOpen,
  Target,
  Shuffle,
  ArrowRight,
  ArrowUpRight,
  Lock,
  Sparkles,
  Check,
  Loader2,
} from "lucide-react";

interface AnalyticsData {
  unique_questions_practiced: number;
  overall_accuracy: number;
  avg_score: number;
  tests_completed: number;
  current_streak: number;
  avg_time_per_question: number;
  weakest_subject: string | null;
  strongest_subject: string | null;
  has_completed_attempts: boolean;
}

type Plan = "free" | "pro" | "mentor";

interface AttemptRow {
  id: string;
  title: string | null;
  status: string;
  created_at: string;
}

const MODES = [
  {
    key: "pyp",
    href: "/test/create?mode=pyp",
    icon: BookOpen,
    title: "Previous Year Paper",
    desc: "Real SSC CGL shift papers (2020–2024) with official TCS answer keys.",
    cta: "Select paper",
  },
  {
    key: "subject",
    href: "/test/create?mode=subject",
    icon: Target,
    title: "Topic Test",
    desc: "Target Reasoning, GA, Quant, or English individually.",
    cta: "Select subject",
  },
  {
    key: "random",
    href: "/test/create?mode=random",
    icon: Shuffle,
    title: "Random Mock",
    desc: "A balanced 100-question mock, 25 per section, drawn from the bank.",
    cta: "Launch mock",
  },
];

export default function DashboardPage() {
  const { examId, isSubmitted, resetTest } = useTestStore();
  const hasActiveAttempt = !!(examId && !isSubmitted);

  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [plan, setPlan] = useState<Plan>("free");
  const [email, setEmail] = useState<string | null>(null);
  const [latestAttempt, setLatestAttempt] = useState<AttemptRow | null>(null);
  const [loading, setLoading] = useState(true);

  const [paying, setPaying] = useState<null | Plan>(null);
  const [payError, setPayError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [me, an, hist] = await Promise.all([
          fetch("/api/auth/me"),
          fetch("/api/cbt/analytics"),
          fetch("/api/cbt/history?limit=5"),
        ]);
        if (me.ok) {
          const viewer = await me.json();
          setPlan((viewer.plan as Plan) ?? "free");
          setEmail(viewer.email ?? null);
        }
        if (an.ok) setAnalytics(await an.json());
        if (hist.ok) {
          const j = await hist.json();
          setLatestAttempt((j.attempts?.[0] as AttemptRow) ?? null);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const canPractice = plan === "pro" || plan === "mentor";
  const canMentor = plan === "mentor";
  const hasData = analytics?.has_completed_attempts ?? false;
  const dash = (v: React.ReactNode) => (loading ? "…" : v);

  function upgrade(target: Plan) {
    if (target === "free") return;
    const paidTarget = target === "mentor" ? "mentor" : "pro";
    setPayError(null);
    setPaying(target);
    void startRazorpayCheckout({
      plan: paidTarget,
      prefill: email ? { email } : undefined,
      // Payment captured + signature verified, but the plan is granted by the
      // webhook, not this callback. Show a "confirming" state and poll until the
      // webhook lands, then reload. On timeout the payment is still safe (the
      // webhook applies it independently); we just ask the user to refresh.
      onSuccess: async () => {
        setPaying(null);
        setConfirming(true);
        const upgraded = await waitForPlanUpgrade(paidTarget);
        setConfirming(false);
        if (upgraded) window.location.reload();
        else
          setPayError(
            "Payment received, we're confirming your upgrade. It'll appear in a moment; refresh if it doesn't."
          );
      },
      onError: (m) => {
        setPayError(m);
        setPaying(null);
      },
      onDismiss: () => setPaying(null),
    });
  }

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <TopNav />

      <main className="mx-auto w-full max-w-6xl flex-1 space-y-10 px-4 py-10 sm:px-6">
        {/* Payment confirming, webhook grants the plan asynchronously */}
        {confirming && (
          <Card className="flex items-center gap-3 border-accent/30 bg-accent-soft p-4">
            <Loader2 className="h-5 w-5 flex-shrink-0 animate-spin text-accent" />
            <p className="text-sm text-ink">
              Payment received, confirming your upgrade. This takes a few seconds…
            </p>
          </Card>
        )}

        {/* Resume banner */}
        {hasActiveAttempt && (
          <Card className="flex flex-col items-start justify-between gap-4 border-warning/30 bg-warning-soft p-5 sm:flex-row sm:items-center">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 animate-pulse rounded-full bg-warning" />
                <h3 className="text-sm font-semibold text-ink">Active test in progress</h3>
              </div>
              <p className="text-xs text-ink-secondary">
                You have an ongoing exam session saved on this device.
              </p>
            </div>
            <div className="flex w-full items-center gap-2 sm:w-auto">
              <button
                onClick={() => {
                  if (confirm("Discard your current active test? Progress will be lost."))
                    resetTest();
                }}
                className="min-h-[40px] flex-1 rounded-lg border border-hairline-strong px-3 py-2 text-xs font-semibold text-ink-secondary transition-premium hover:bg-panel sm:flex-none"
              >
                Discard
              </button>
              <ButtonLink href={`/test/${examId}`} variant="primary" size="sm" className="flex-1 sm:flex-none">
                Resume test
              </ButtonLink>
            </div>
          </Card>
        )}

        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1.5">
            <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">Dashboard</h1>
            <p className="text-sm text-ink-secondary">
              {canPractice
                ? hasData
                  ? "Performance analytics from your completed CBT mocks."
                  : "Take a mock to unlock your analytics."
                : "Your free plan includes one sample. Upgrade to unlock the full bank."}
            </p>
          </div>
          <PlanBadge plan={plan} loading={loading} />
        </div>

        {/* Plan banner: upgrade path for free/pro */}
        <div id="upgrade" className="scroll-mt-24 empty:hidden">
          {!loading && plan === "free" && (
            <UpgradePanel
              heading="Unlock the full practice bank"
              sub="Free gives you one sample. Go Pro for the entire 10,000+ question bank, unlimited mocks, and full deterministic reports."
              latestAttempt={latestAttempt}
              paying={paying}
              payError={payError}
              onUpgrade={upgrade}
              showBoth
            />
          )}
          {!loading && plan === "pro" && (
            <UpgradePanel
              heading="Add the AI Mentor"
              sub="You have full practice + reports. Upgrade to Mentor for the skip strategy, break-even guess rule, and your score-maximisation plan."
              latestAttempt={null}
              paying={paying}
              payError={payError}
              onUpgrade={upgrade}
            />
          )}
        </div>

        {/* Metrics */}
        <section className="space-y-3">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatTile label="Unique Questions Practised" value={dash(analytics?.unique_questions_practiced ?? 0)} empty={!loading && !hasData} />
            <StatTile label="Overall Accuracy" value={dash(hasData ? `${analytics!.overall_accuracy.toFixed(1)}%` : ", ")} empty={!loading && !hasData} valueClassName={hasData ? "text-success" : undefined} />
            <StatTile label="Average Score" value={dash(hasData ? `${analytics!.avg_score.toFixed(1)}/200` : ", ")} empty={!loading && !hasData} valueClassName={hasData ? "text-accent" : undefined} />
            <StatTile label="Tests Completed" value={dash(analytics?.tests_completed ?? 0)} empty={!loading && !hasData} />
            <StatTile label="Current Streak" value={dash(`${analytics?.current_streak ?? 0}d`)} empty={!loading && !hasData} />
            <StatTile label="Avg Time / Question" value={dash(hasData ? `${analytics!.avg_time_per_question}s` : ", ")} empty={!loading && !hasData} />
            <StatTile label="Weakest Subject" value={dash(analytics?.weakest_subject ? sectionLabel(analytics.weakest_subject) : ", ")} empty={!loading && !hasData} valueClassName="text-base font-semibold text-danger truncate" />
            <StatTile label="Strongest Subject" value={dash(analytics?.strongest_subject ? sectionLabel(analytics.strongest_subject) : ", ")} empty={!loading && !hasData} valueClassName="text-base font-semibold text-success truncate" />
          </div>
          {!loading && !canPractice && (
            <p className="flex items-center gap-1.5 text-xs text-ink-tertiary">
              <Lock className="h-3.5 w-3.5" /> Detailed stats, history, and reports unlock with Pro.
            </p>
          )}
        </section>

        {/* Start a session */}
        <section className="space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-tertiary">
            {canPractice ? "Start a session" : "Practice modes"}
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {MODES.map((m) =>
              canPractice ? (
                <Link key={m.key} href={m.href} className="group">
                  <Card interactive className="flex h-full flex-col justify-between p-6">
                    <div className="space-y-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-soft text-accent">
                        <m.icon className="h-5 w-5" />
                      </span>
                      <h3 className="text-base font-semibold text-ink">{m.title}</h3>
                      <p className="text-sm leading-relaxed text-ink-secondary">{m.desc}</p>
                    </div>
                    <div className="mt-5 flex items-center justify-between border-t border-hairline pt-4 text-sm font-semibold text-accent">
                      <span>{m.cta}</span>
                      <ArrowRight className="h-4 w-4 transition-premium group-hover:translate-x-0.5" />
                    </div>
                  </Card>
                </Link>
              ) : (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => upgrade("pro")}
                  disabled={paying !== null}
                  aria-label={`${m.title}, unlock with Pro`}
                  className="group text-left"
                >
                  <Card className="relative flex h-full flex-col justify-between overflow-hidden p-6 opacity-90">
                    <span className="absolute right-3 top-3 flex items-center gap-1 rounded-md bg-gold-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gold">
                      <Lock className="h-3 w-3" /> Pro
                    </span>
                    <div className="space-y-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-panel text-ink-tertiary">
                        <m.icon className="h-5 w-5" />
                      </span>
                      <h3 className="text-base font-semibold text-ink">{m.title}</h3>
                      <p className="text-sm leading-relaxed text-ink-secondary">{m.desc}</p>
                    </div>
                    <div className="mt-5 flex items-center justify-between border-t border-hairline pt-4 text-sm font-semibold text-gold">
                      <span>Unlock with Pro, ₹19</span>
                      <Lock className="h-4 w-4" />
                    </div>
                  </Card>
                </button>
              )
            )}
          </div>
        </section>

        {/* AI Mentor surface */}
        {!loading && (
          <section className="space-y-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-tertiary">AI Mentor</h2>
            {canMentor ? (
              <Card className="flex items-center gap-3 border-gold-bright/30 bg-gold-soft p-5">
                <Sparkles className="h-5 w-5 flex-shrink-0 text-gold" />
                <p className="text-sm text-ink">
                  AI Mentor is <span className="font-semibold text-gold">active</span>. Open any completed
                  test&apos;s report to see your skip strategy, guess rule, and score-maximisation plan.
                </p>
              </Card>
            ) : (
              <Card className="flex flex-col items-start justify-between gap-4 p-5 sm:flex-row sm:items-center">
                <div className="flex items-start gap-3">
                  <Sparkles className="mt-0.5 h-5 w-5 flex-shrink-0 text-gold" />
                  <div>
                    <p className="text-sm font-semibold text-ink">AI Mentor, the score-maximisation engine</p>
                    <p className="mt-0.5 text-sm text-ink-secondary">
                      Your exact skip strategy, break-even guess rule, and the marks you left on the table.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => upgrade("mentor")}
                  disabled={paying !== null}
                  className="inline-flex min-h-[44px] w-full flex-shrink-0 items-center justify-center gap-2 rounded-lg bg-gold-bright px-4 py-2 text-sm font-semibold text-white transition-premium hover:bg-gold disabled:opacity-60 sm:w-auto"
                >
                  {paying === "mentor" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                  Unlock Mentor, ₹79
                </button>
              </Card>
            )}
          </section>
        )}

        {/* Recent sessions */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-tertiary">Recent sessions</h2>
            {hasData && (
              <Link href="/analytics" className="flex items-center gap-1 text-xs font-semibold text-accent">
                View all <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>
          {!hasData && !loading && (
            <Card className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
              <p className="text-sm font-medium text-ink">No sessions yet</p>
              <p className="max-w-sm text-sm text-ink-secondary">
                {canPractice
                  ? "Complete a mock to see your recent attempts and their reports here."
                  : "Take your free sample to see your score and a preview of the full report."}
              </p>
              <ButtonLink
                href={canPractice ? "/test/create?mode=pyp" : "/sample"}
                variant="secondary"
                size="sm"
                className="mt-2"
              >
                {canPractice ? "Take your first mock" : "Take your free sample"}
              </ButtonLink>
            </Card>
          )}
        </section>
      </main>
    </div>
  );
}

function PlanBadge({ plan, loading }: { plan: Plan; loading: boolean }) {
  if (loading) return null;
  const map: Record<Plan, { label: string; cls: string }> = {
    free: { label: "Free", cls: "bg-panel text-ink-secondary border-hairline-strong" },
    pro: { label: "Pro", cls: "bg-accent-soft text-accent border-accent/30" },
    mentor: { label: "Mentor", cls: "bg-gold-soft text-gold border-gold-bright/40" },
  };
  const b = map[plan];
  return (
    <span className={cn("rounded-full border px-3 py-1 text-xs font-semibold", b.cls)}>{b.label} plan</span>
  );
}

function UpgradePanel({
  heading,
  sub,
  latestAttempt,
  paying,
  payError,
  onUpgrade,
  showBoth = false,
}: {
  heading: string;
  sub: string;
  latestAttempt: AttemptRow | null;
  paying: Plan | null;
  payError: string | null;
  onUpgrade: (plan: Plan) => void;
  showBoth?: boolean;
}) {
  const PRO_PERKS = [
    "Full 10,000+ question bank",
    "Unlimited PYP, Topic & Random mocks",
    "Complete section & timing reports",
  ];
  return (
    <Card className="space-y-5 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-ink">{heading}</h2>
          <p className="max-w-xl text-sm text-ink-secondary">{sub}</p>
        </div>
        {latestAttempt && (
          <ButtonLink href={`/test/${latestAttempt.id}/result`} variant="secondary" size="sm">
            View your sample result
          </ButtonLink>
        )}
      </div>

      {showBoth && (
        <ul className="grid gap-2 sm:grid-cols-3">
          {PRO_PERKS.map((p) => (
            <li key={p} className="flex items-center gap-2 text-sm text-ink-secondary">
              <Check className="h-4 w-4 flex-shrink-0 text-success" /> {p}
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        {showBoth && (
          <button
            onClick={() => onUpgrade("pro")}
            disabled={paying !== null}
            className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-white shadow-soft transition-premium hover:bg-accent-hover disabled:opacity-60"
          >
            {paying === "pro" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Go Pro, ₹19/mo
          </button>
        )}
        <button
          onClick={() => onUpgrade("mentor")}
          disabled={paying !== null}
          className={cn(
            "inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold transition-premium disabled:opacity-60",
            "bg-gold-bright text-white hover:bg-gold"
          )}
        >
          {paying === "mentor" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {showBoth ? "Go Mentor, ₹79/mo" : "Unlock Mentor, ₹79/mo"}
        </button>
      </div>

      {payError && <p className="text-sm text-danger">{payError}</p>}
      <p className="text-xs text-ink-tertiary">Honest founding prices, no fake discounts. Cancel anytime.</p>
      <RazorpayBadge className="pt-1" />
    </Card>
  );
}
