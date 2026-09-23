"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useTestStore } from "@/lib/store/use-test-store";
import { TopNav } from "@/components/top-nav";
import { RazorpayBadge } from "@/components/payments/razorpay-badge";
import { Card } from "@/components/ui/card";
import { StatTile } from "@/components/ui/stat-tile";
import { ButtonLink } from "@/components/ui/button";
import { sectionLabel } from "@/lib/cbt-questions";
import { MarksenseEntry } from "@/components/marksense/entry";
import { startRazorpayCheckout, waitForPlanUpgrade } from "@/lib/payments/razorpay-checkout";
import { allAccessPriceInr, isLaunchOffer, ALL_ACCESS_REGULAR_PRICE_INR, ALL_ACCESS_OFFER_END_LABEL } from "@/lib/payments/pricing";
import { LEGAL_VERSION } from "@/lib/legal";
import { cn } from "@/lib/utils";
import {
  BookOpen,
  Target,
  Shuffle,
  ArrowRight,
  ArrowLeft,
  ArrowUpRight,
  Lock,
  Sparkles,
  Check,
  Loader2,
  BellRing,
  ChevronRight,
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

const EXAMS = [
  { slug: "ssc-cgl", name: "SSC CGL", tagline: "Tier 1 · 2026 pattern", live: true },
  { slug: "ibps-clerk", name: "IBPS Clerk", tagline: "Prelims + Mains", live: false },
  { slug: "sbi-clerk", name: "SBI Clerk", tagline: "Prelims + Mains", live: false },
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

  // Two-stage view: "hub" (choose an exam) → "exam" (that exam's dashboard).
  // The hub is always the landing so the exam choice is the first thing seen.
  const [stage, setStage] = useState<"hub" | "exam">("hub");
  const [notified, setNotified] = useState<string[]>([]);
  const [savingExam, setSavingExam] = useState<string | null>(null);
  const [planExpiresAt, setPlanExpiresAt] = useState<string | null>(null);

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
          setPlanExpiresAt((viewer.planExpiresAt as string | null) ?? null);
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

  // Auto-open checkout when arriving from a pricing CTA (/dashboard?checkout=
  // <plan>:<billing>), once the account's current plan is known. Runs once.
  const autoCheckoutRan = useRef(false);
  useEffect(() => {
    if (loading || autoCheckoutRan.current) return;
    const intent = new URLSearchParams(window.location.search).get("checkout");
    if (!intent) return;
    autoCheckoutRan.current = true;
    window.history.replaceState({}, "", "/dashboard");
    // A checkout link is exam-agnostic; drop the buyer straight onto the exam view.
    setStage("exam");
    const [p] = intent.split(":");
    const known = p === "allaccess" || p === "mentor" || p === "pro";
    if (!known) return;
    if (plan === "mentor") return;
    upgrade();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, plan]);

  const canPractice = plan === "pro" || plan === "mentor";
  const hasData = analytics?.has_completed_attempts ?? false;
  const dash = (v: React.ReactNode) => (loading ? "…" : v);

  function upgrade() {
    const paidTarget: Plan = "mentor";
    setPayError(null);
    setPaying(paidTarget);
    void startRazorpayCheckout({
      plan: "mentor",
      consent: { policyVersion: LEGAL_VERSION, consentAt: new Date().toISOString() },
      prefill: email ? { email } : undefined,
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

  // Register interest in a coming-soon exam (waitlist), keeping SSC CGL primary.
  async function notifyExam(slug: string) {
    if (notified.includes(slug)) return;
    setSavingExam(slug);
    try {
      await fetch("/api/exam/preference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ primary: "ssc-cgl", notify: [...notified, slug] }),
      });
      setNotified((n) => [...n, slug]);
    } catch {
      /* non-blocking */
    } finally {
      setSavingExam(null);
    }
  }

  function openExam() {
    setStage("exam");
    // Persist the primary choice; harmless if already set.
    void fetch("/api/exam/preference", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ primary: "ssc-cgl", notify: notified }),
    }).catch(() => {});
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <TopNav />

      <main className="mx-auto w-full max-w-6xl flex-1 space-y-8 px-4 py-8 sm:px-6 sm:py-10">
        {/* Payment confirming, webhook grants the plan asynchronously */}
        {confirming && (
          <Card className="flex items-center gap-3 border-accent/30 bg-accent-soft p-4">
            <Loader2 className="h-5 w-5 flex-shrink-0 animate-spin text-accent" />
            <p className="text-sm text-ink">
              Payment received, confirming your upgrade. This takes a few seconds…
            </p>
          </Card>
        )}

        {/* Resume banner, shown in either stage */}
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

        {stage === "hub" ? (
          <ExamHub
            loading={loading}
            plan={plan}
            analytics={analytics}
            hasData={hasData}
            canPractice={canPractice}
            notified={notified}
            savingExam={savingExam}
            onOpen={openExam}
            onNotify={notifyExam}
          />
        ) : (
          <ExamDashboard
            loading={loading}
            plan={plan}
            analytics={analytics}
            hasData={hasData}
            canPractice={canPractice}
            dash={dash}
            planExpiresAt={planExpiresAt}
            latestAttempt={latestAttempt}
            paying={paying}
            payError={payError}
            onUpgrade={upgrade}
            onBack={() => setStage("hub")}
          />
        )}
      </main>
    </div>
  );
}

/* ----------------------------- Stage 1: hub ----------------------------- */
function ExamHub({
  loading,
  plan,
  analytics,
  hasData,
  canPractice,
  notified,
  savingExam,
  onOpen,
  onNotify,
}: {
  loading: boolean;
  plan: Plan;
  analytics: AnalyticsData | null;
  hasData: boolean;
  canPractice: boolean;
  notified: string[];
  savingExam: string | null;
  onOpen: () => void;
  onNotify: (slug: string) => void;
}) {
  return (
    <div className="space-y-8">
      {/* Greeting */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            Choose your exam
          </h1>
          <p className="text-sm text-ink-secondary">
            SSC CGL is live today. Open it to see your dashboard and start a session.
          </p>
        </div>
        <PlanBadge plan={plan} loading={loading} />
      </div>

      {/* Overall status, compact */}
      <OverallStatus
        loading={loading}
        analytics={analytics}
        hasData={hasData}
        canPractice={canPractice}
      />

      {/* Exam cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {EXAMS.map((e) =>
          e.live ? (
            <button key={e.slug} type="button" onClick={onOpen} className="group text-left">
              <Card
                interactive
                className="relative flex h-full flex-col justify-between overflow-hidden p-6"
              >
                <div
                  className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                  style={{ background: "radial-gradient(80% 60% at 100% 0%, rgba(79,70,229,0.10), transparent 60%)" }}
                  aria-hidden
                />
                <div className="relative space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-soft text-accent">
                      <Target className="h-5 w-5" />
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-success">
                      <Check className="h-3 w-3" /> Live now
                    </span>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-ink">{e.name}</h3>
                    <p className="text-xs text-ink-tertiary">{e.tagline}</p>
                  </div>
                </div>
                <div className="relative mt-5 flex items-center justify-between border-t border-hairline pt-4 text-sm font-semibold text-accent">
                  <span>Open dashboard</span>
                  <ArrowRight className="h-4 w-4 transition-premium group-hover:translate-x-0.5" />
                </div>
              </Card>
            </button>
          ) : (
            <Card key={e.slug} className="flex h-full flex-col justify-between p-6 opacity-95">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-panel text-ink-tertiary">
                    <Lock className="h-5 w-5" />
                  </span>
                  <span className="rounded-full bg-panel px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink-tertiary ring-1 ring-hairline">
                    Coming soon
                  </span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-ink">{e.name}</h3>
                  <p className="text-xs text-ink-tertiary">{e.tagline}</p>
                </div>
              </div>
              <button
                type="button"
                disabled={savingExam === e.slug || notified.includes(e.slug)}
                onClick={() => onNotify(e.slug)}
                className={cn(
                  "mt-5 flex items-center justify-between gap-2 border-t border-hairline pt-4 text-sm font-semibold transition-premium",
                  notified.includes(e.slug) ? "text-success" : "text-ink-secondary hover:text-ink"
                )}
              >
                {savingExam === e.slug ? (
                  <>
                    <span className="inline-flex items-center gap-1.5"><Loader2 className="h-4 w-4 animate-spin" /> Saving…</span>
                  </>
                ) : notified.includes(e.slug) ? (
                  <>
                    <span className="inline-flex items-center gap-1.5"><Check className="h-4 w-4" /> We&apos;ll notify you</span>
                  </>
                ) : (
                  <>
                    <span className="inline-flex items-center gap-1.5"><BellRing className="h-4 w-4" /> Notify me at launch</span>
                    <ChevronRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </Card>
          )
        )}
      </div>
    </div>
  );
}

function OverallStatus({
  loading,
  analytics,
  hasData,
  canPractice,
}: {
  loading: boolean;
  analytics: AnalyticsData | null;
  hasData: boolean;
  canPractice: boolean;
}) {
  if (loading) {
    return (
      <Card className="flex items-center gap-2 p-5 text-sm text-ink-tertiary">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading your status…
      </Card>
    );
  }

  // No data yet: a single, inviting prompt rather than empty tiles.
  if (!hasData) {
    return (
      <Card className="flex flex-col items-start justify-between gap-4 p-5 sm:flex-row sm:items-center">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-ink">
            {canPractice ? "Ready when you are" : "You haven't taken a mock yet"}
          </p>
          <p className="text-sm text-ink-secondary">
            {canPractice
              ? "Take your first mock to unlock your analytics and MarksenseAI report."
              : "Try the free sample to see your score and a preview of the full report."}
          </p>
        </div>
        <ButtonLink
          href={canPractice ? "/test/create?mode=pyp" : "/sample"}
          variant="secondary"
          size="sm"
          className="flex-shrink-0"
        >
          {canPractice ? "Take your first mock" : "Take the free sample"}
        </ButtonLink>
      </Card>
    );
  }

  // Compact snapshot: the three numbers that matter at a glance.
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-ink-tertiary">Overall status</p>
        <Link href="/analytics" className="flex items-center gap-1 text-xs font-semibold text-accent">
          Full analytics <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <MiniStat label="Tests completed" value={`${analytics!.tests_completed}`} />
        <MiniStat label="Average score" value={`${analytics!.avg_score.toFixed(0)}/200`} tone="accent" />
        <MiniStat label="Current streak" value={`${analytics!.current_streak}d`} />
      </div>
    </Card>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone?: "accent" }) {
  return (
    <div className="text-center sm:text-left">
      <p className={cn("text-2xl font-bold tabular-nums sm:text-3xl", tone === "accent" ? "text-accent" : "text-ink")}>
        {value}
      </p>
      <p className="mt-0.5 text-xs text-ink-tertiary">{label}</p>
    </div>
  );
}

/* -------------------------- Stage 2: exam view -------------------------- */
function ExamDashboard({
  loading,
  plan,
  analytics,
  hasData,
  canPractice,
  dash,
  planExpiresAt,
  latestAttempt,
  paying,
  payError,
  onUpgrade,
  onBack,
}: {
  loading: boolean;
  plan: Plan;
  analytics: AnalyticsData | null;
  hasData: boolean;
  canPractice: boolean;
  dash: (v: React.ReactNode) => React.ReactNode;
  planExpiresAt: string | null;
  latestAttempt: AttemptRow | null;
  paying: Plan | null;
  payError: string | null;
  onUpgrade: () => void;
  onBack: () => void;
}) {
  return (
    <div className="space-y-8">
      {/* Back + header */}
      <div>
        <button
          onClick={onBack}
          className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold text-ink-tertiary transition-premium hover:text-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> All exams
        </button>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1.5">
            <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">SSC CGL</h1>
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
      </div>

      {/* Upgrade path for free/pro */}
      <div id="upgrade" className="scroll-mt-24 empty:hidden">
        {!loading && plan === "free" && (
          <UpgradePanel
            heading="Unlock everything with All-Access"
            sub="Free gives you one sample. One All-Access pass unlocks every exam, the entire 10,000+ question bank, unlimited mocks, full reports, and the MarksenseAI engine."
            latestAttempt={latestAttempt}
            paying={paying}
            payError={payError}
            onUpgrade={onUpgrade}
          />
        )}
        {!loading && plan === "pro" && (
          <UpgradePanel
            heading="Add the MarksenseAI with All-Access"
            sub="You have full practice + reports. All-Access adds the MarksenseAI decision engine, your skip strategy, break-even guess rule, and score-maximisation plan, on top."
            latestAttempt={null}
            paying={paying}
            payError={payError}
            onUpgrade={onUpgrade}
          />
        )}
      </div>

      {/* Metrics */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-tertiary">Your metrics</h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatTile label="Unique Questions Practised" value={dash(analytics?.unique_questions_practiced ?? 0)} empty={!loading && !hasData} />
          <StatTile label="Overall Accuracy" value={dash(hasData ? `${analytics!.overall_accuracy.toFixed(1)}%` : "—")} empty={!loading && !hasData} valueClassName={hasData ? "text-success" : undefined} />
          <StatTile label="Average Score" value={dash(hasData ? `${analytics!.avg_score.toFixed(1)}/200` : "—")} empty={!loading && !hasData} valueClassName={hasData ? "text-accent" : undefined} />
          <StatTile label="Tests Completed" value={dash(analytics?.tests_completed ?? 0)} empty={!loading && !hasData} />
          <StatTile label="Current Streak" value={dash(`${analytics?.current_streak ?? 0}d`)} empty={!loading && !hasData} />
          <StatTile label="Avg Time / Question" value={dash(hasData ? `${analytics!.avg_time_per_question}s` : "—")} empty={!loading && !hasData} />
          <StatTile label="Weakest Subject" value={dash(analytics?.weakest_subject ? sectionLabel(analytics.weakest_subject) : "—")} empty={!loading && !hasData} valueClassName="text-base font-semibold text-danger truncate" />
          <StatTile label="Strongest Subject" value={dash(analytics?.strongest_subject ? sectionLabel(analytics.strongest_subject) : "—")} empty={!loading && !hasData} valueClassName="text-base font-semibold text-success truncate" />
        </div>
        {!loading && !canPractice && (
          <p className="flex items-center gap-1.5 text-xs text-ink-tertiary">
            <Lock className="h-3.5 w-3.5" /> Detailed stats, history, and reports unlock with All-Access.
          </p>
        )}
      </section>

      {/* MarksenseAI: single CTA. Deeper links live inside MarksenseAI itself. */}
      {!loading && (
        <section className="space-y-2">
          {plan === "mentor" && planExpiresAt && (
            <p className="text-xs font-medium text-ink-tertiary">MarksenseAI renews {fmtDate(planExpiresAt)}</p>
          )}
          <MarksenseEntry plan={plan} onUnlock={onUpgrade} />
        </section>
      )}

      {/* Start a session, high-visibility */}
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
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-soft text-accent">
                      <m.icon className="h-5 w-5" />
                    </span>
                    <h3 className="text-base font-semibold text-ink">{m.title}</h3>
                    <p className="text-sm leading-relaxed text-ink-secondary">{m.desc}</p>
                  </div>
                  <div className="mt-5 flex items-center justify-between rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-premium group-hover:bg-accent-hover">
                    <span>{m.cta}</span>
                    <ArrowRight className="h-4 w-4 transition-premium group-hover:translate-x-0.5" />
                  </div>
                </Card>
              </Link>
            ) : (
              <button
                key={m.key}
                type="button"
                onClick={onUpgrade}
                disabled={paying !== null}
                aria-label={`${m.title}, unlock with All-Access`}
                className="group text-left"
              >
                <Card className="relative flex h-full flex-col justify-between overflow-hidden p-6 opacity-90">
                  <span className="absolute right-3 top-3 flex items-center gap-1 rounded-md bg-gold-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gold">
                    <Lock className="h-3 w-3" /> All-Access
                  </span>
                  <div className="space-y-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-panel text-ink-tertiary">
                      <m.icon className="h-5 w-5" />
                    </span>
                    <h3 className="text-base font-semibold text-ink">{m.title}</h3>
                    <p className="text-sm leading-relaxed text-ink-secondary">{m.desc}</p>
                  </div>
                  <div className="mt-5 flex items-center justify-between rounded-lg bg-gold-bright px-4 py-2.5 text-sm font-semibold text-white transition-premium group-hover:bg-gold">
                    <span>Unlock All-Access, ₹{allAccessPriceInr()}</span>
                    <Lock className="h-4 w-4" />
                  </div>
                </Card>
              </button>
            )
          )}
        </div>
      </section>

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
    </div>
  );
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return "";
  }
}

function PlanBadge({ plan, loading }: { plan: Plan; loading: boolean }) {
  if (loading) return null;
  const map: Record<Plan, { label: string; cls: string }> = {
    free: { label: "Free", cls: "bg-panel text-ink-secondary border-hairline-strong" },
    pro: { label: "Pro", cls: "bg-accent-soft text-accent border-accent/30" },
    mentor: { label: "MarksenseAI", cls: "bg-gold-soft text-gold border-gold-bright/40" },
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
}: {
  heading: string;
  sub: string;
  latestAttempt: AttemptRow | null;
  paying: Plan | null;
  payError: string | null;
  onUpgrade: () => void;
}) {
  const [agreed, setAgreed] = useState(false);
  const ALL_ACCESS_PERKS = [
    "Every exam, current & upcoming",
    "Full 10,000+ question bank · unlimited mocks",
    "Complete reports + the MarksenseAI engine",
  ];
  const launch = isLaunchOffer();
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

      <ul className="grid gap-2 sm:grid-cols-3">
        {ALL_ACCESS_PERKS.map((p) => (
          <li key={p} className="flex items-center gap-2 text-sm text-ink-secondary">
            <Check className="h-4 w-4 flex-shrink-0 text-success" /> {p}
          </li>
        ))}
      </ul>

      {/* Pre-purchase consent (E2): affirmative, unticked by default. */}
      <label className="flex items-start gap-2.5 text-xs leading-relaxed text-ink-secondary">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5 h-4 w-4 flex-shrink-0 rounded border-hairline-strong text-accent focus:ring-accent/30"
        />
        <span>
          I have read and agree to the{" "}
          <Link href="/terms" target="_blank" className="font-medium text-accent hover:underline">Terms</Link>,{" "}
          <Link href="/privacy-policy" target="_blank" className="font-medium text-accent hover:underline">Privacy Policy</Link>{" "}
          and the no-refund{" "}
          <Link href="/refund-policy" target="_blank" className="font-medium text-accent hover:underline">Cancellation &amp; Refund Policy</Link>.
        </span>
      </label>

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          onClick={() => onUpgrade()}
          disabled={paying !== null || !agreed}
          className={cn(
            "inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold transition-premium disabled:opacity-50",
            "bg-gold-bright text-white hover:bg-gold"
          )}
        >
          {paying !== null ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Unlock All-Access, ₹{allAccessPriceInr()}
          {launch && <span className="text-white/70">one-time</span>}
        </button>
      </div>

      {payError && <p className="text-sm text-danger">{payError}</p>}
      <p className="text-xs text-ink-tertiary">
        {launch
          ? `One-time payment, full access until ${ALL_ACCESS_OFFER_END_LABEL}. Then ₹${ALL_ACCESS_REGULAR_PRICE_INR}/month.`
          : `Every exam + MarksenseAI, ₹${ALL_ACCESS_REGULAR_PRICE_INR}/month.`}
      </p>
      <RazorpayBadge className="pt-1" />
    </Card>
  );
}
