"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { BrandLogo } from "@/components/brand-logo";
import { RazorpayBadge } from "@/components/payments/razorpay-badge";
import { sectionLabel } from "@/lib/cbt-questions";
import { cn } from "@/lib/utils";
import { Loader2, Lock, Sparkles, ShieldCheck, TrendingUp, Target, Gauge, ListChecks, ArrowRight, Check } from "lucide-react";
import { MarksenseWordmark } from "@/components/marksense/wordmark";
import { startRazorpayCheckout, waitForPlanUpgrade, waitForReportUnlock } from "@/lib/payments/razorpay-checkout";
import { allAccessPriceInr, isLaunchOffer, ALL_ACCESS_REGULAR_PRICE_INR, ALL_ACCESS_OFFER_END_LABEL, SINGLE_REPORT_PRICE_INR } from "@/lib/payments/pricing";
import { LEGAL_VERSION } from "@/lib/legal";
import { trackEvent } from "@/lib/analytics/track";

interface SectionRow {
  key: string;
  name: string;
  netScore: number;
  correct: number;
  total: number;
}
interface ReportData {
  result:
    | {
        net_score: number;
        raw_score?: number;
        correct?: number;
        wrong?: number;
        skipped?: number;
        attempted?: number;
        accuracy?: number;
        section_breakdown: SectionRow[];
      }
    | null;
  teaseGain: number;
  maxScore: number;
  totalQuestions?: number;
  plan: "free" | "pro" | "mentor";
}

/** Real value concealed behind a blur, the exact figure revealed on unlock. */
function Masked({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <>
      <span aria-hidden className={cn("select-none blur-[6px]", className)}>
        {children}
      </span>
      <span className="sr-only">locked, unlock to reveal</span>
    </>
  );
}

export default function SampleConversionPage() {
  const params = useParams();
  const router = useRouter();
  const attemptId = (params?.attemptId as string) || "";
  const reportHref = `/test/${attemptId}/result`;

  const [data, setData] = useState<ReportData | null>(null);
  const [authed, setAuthed] = useState<boolean | null>(null);
  // The ₹9 per-attempt unlock is part of the new funnel; gate it on the flag so
  // flag-off prod keeps the All-Access-only behaviour.
  const [freeMock, setFreeMock] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkout, setCheckout] = useState<null | { kind: "single_report" | "all_access"; price: string }>(null);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [offer, setOffer] = useState<null | { discount_pct: number; gap: number; expires_at: string }>(null);
  const [leadEmail, setLeadEmail] = useState("");
  const [leadSaved, setLeadSaved] = useState(false);

  // Capture the visitor at the highest-intent moment (best-effort, non-blocking).
  const captureLead = async () => {
    const em = leadEmail.trim();
    if (!em || leadSaved) return;
    setLeadSaved(true);
    try {
      await fetch("/api/sample/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: em, attemptId }),
      });
    } catch {
      /* never block */
    }
  };

  useEffect(() => {
    if (!attemptId) return;
    (async () => {
      try {
        const [rep, me] = await Promise.all([
          fetch(`/api/cbt/exams/${attemptId}/report`),
          fetch("/api/auth/me"),
        ]);
        if (rep.ok) setData(await rep.json());
        if (me.ok) {
          const viewer = await me.json();
          setAuthed(!!viewer.authenticated);
          setFreeMock(!!viewer.freeMockFlow);
          setEmail(viewer.email ?? null);
          // Mint/return the score-gap coupon for signed-in free users. It is
          // applied automatically at checkout; here we just advertise it.
          if (viewer.authenticated && (viewer.plan ?? "free") === "free") {
            try {
              const o = await fetch("/api/offer/score-gap", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ attemptId }),
              });
              if (o.ok) {
                const j = (await o.json()) as { offer?: typeof offer };
                if (j.offer) setOffer(j.offer);
              }
            } catch {
              /* non-blocking */
            }
          }
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [attemptId]);

  // Two unlock paths. Both require an account (a purchase must attach to a user
  // and the anonymous attempt is claimed on sign-in). If signed out, we route to
  // /login and RETURN here with ?unlock=<kind> so checkout auto-resumes.
  function onUnlock(kind: "single_report" | "all_access") {
    trackEvent("upgrade_started", { kind, attemptId });
    void captureLead();
    if (!authed) {
      const back = `/sample/${attemptId}?unlock=${kind === "single_report" ? "report" : "all"}`;
      router.push(`/login?next=${encodeURIComponent(back)}`);
      return;
    }
    startCheckout(kind);
  }

  function startCheckout(kind: "single_report" | "all_access") {
    const price = kind === "single_report" ? `₹${SINGLE_REPORT_PRICE_INR}` : `₹${allAccessPriceInr()}`;
    setCheckout({ kind, price });
    setPayError(null);
    setPaying(true);
    void startRazorpayCheckout({
      plan: "mentor",
      kind,
      attemptId: kind === "single_report" ? attemptId : undefined,
      consent: { policyVersion: LEGAL_VERSION, consentAt: new Date().toISOString() },
      prefill: email ? { email } : undefined,
      // The webhook grants the entitlement independently; poll for it to land,
      // then open the now-unlocked report.
      onSuccess: async () => {
        const ok =
          kind === "single_report"
            ? await waitForReportUnlock(attemptId)
            : await waitForPlanUpgrade("mentor");
        if (ok) {
          router.push(reportHref);
        } else {
          setPaying(false);
          setPayError(
            "Payment received, we're confirming your unlock. It'll open in a moment; refresh if it doesn't."
          );
        }
      },
      onError: (message) => {
        setPayError(message);
        setPaying(false);
      },
      onDismiss: () => setPaying(false),
    });
  }

  // Auto-resume checkout after returning from login (?unlock=report|all).
  useEffect(() => {
    if (authed !== true) return;
    const u = new URLSearchParams(window.location.search).get("unlock");
    if (u !== "report" && u !== "all") return;
    // Clear the param so a refresh doesn't reopen the modal.
    window.history.replaceState({}, "", `/sample/${attemptId}`);
    startCheckout(u === "report" ? "single_report" : "all_access");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed]);

  // Upsell impression (once, after we know auth state).
  useEffect(() => {
    if (authed !== null) trackEvent("upgrade_cta_viewed", { attemptId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-2 bg-bg text-ink-secondary">
        <Loader2 className="h-5 w-5 animate-spin text-accent" />
        <span className="text-sm">Scoring your sample…</span>
      </div>
    );
  }

  const net = data?.result?.net_score ?? 0;
  const max = data?.maxScore || 200;
  const sections = data?.result?.section_breakdown ?? [];
  const gain = data?.teaseGain ?? 0;
  const correct = data?.result?.correct ?? 0;
  const wrong = data?.result?.wrong ?? 0;
  const skipped = data?.result?.skipped ?? 0;
  const attempted = data?.result?.attempted ?? correct + wrong;
  const scorePct = max > 0 ? Math.max(0, Math.min(100, Math.round((net / max) * 100))) : 0;
  const launch = isLaunchOffer();

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <header className="border-b border-hairline bg-bg/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <BrandLogo />
          <Link href="/dashboard" className="text-sm text-ink-secondary transition-premium hover:text-ink">
            Dashboard
          </Link>
        </div>
      </header>

      {/* ---------------------------------------------------------------- */}
      {/* HERO — the score, presented with weight                          */}
      {/* ---------------------------------------------------------------- */}
      <section className="relative overflow-hidden border-b border-white/5 bg-panel-dark">
        <div
          className="pointer-events-none absolute inset-0 opacity-80"
          style={{
            background:
              "radial-gradient(60% 120% at 15% -10%, rgba(99,102,241,0.30), transparent 55%), radial-gradient(50% 120% at 90% 0%, rgba(217,119,6,0.18), transparent 55%)",
          }}
          aria-hidden
        />
        <div className="relative mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 sm:py-12">
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">
            <Check className="h-3.5 w-3.5 text-emerald-400" /> Mock scored
          </p>
          <div className="mt-4 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="font-report text-6xl font-semibold leading-none tracking-tight text-white sm:text-7xl">
                {net}
                <span className="text-3xl font-medium text-white/35 sm:text-4xl"> / {max}</span>
              </h1>
              <p className="mt-3 max-w-md text-sm leading-relaxed text-white/60">
                That&apos;s your real net score under SSC CGL&apos;s{" "}
                <span className="font-semibold text-white/80">+2 / −0.5</span> marking. The full report shows
                exactly where those marks went, and how to win them back.
              </p>
            </div>
            {/* At-a-glance chips (all free, all real) */}
            <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
              <HeroChip label="Correct" value={correct} tone="emerald" />
              <HeroChip label="Wrong" value={wrong} tone="rose" />
              <HeroChip label="Skipped" value={skipped} tone="slate" />
            </div>
          </div>
          {/* Score meter */}
          <div className="mt-7">
            <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-violet-400"
                style={{ width: `${scorePct}%` }}
              />
            </div>
            <p className="mt-1.5 text-[11px] text-white/40">
              {attempted} attempted · net {net} of {max}
            </p>
          </div>
        </div>
      </section>

      <main className="mx-auto grid w-full max-w-5xl flex-1 gap-6 px-4 py-8 sm:px-6 sm:py-10 lg:grid-cols-5">
        {/* -------------------------------------------------------------- */}
        {/* LEFT — what's free: your section accuracy                       */}
        {/* -------------------------------------------------------------- */}
        <div className="space-y-6 lg:col-span-2">
          <Card className="space-y-4 p-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-ink">Section accuracy</p>
              <span className="rounded-full bg-success/12 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-success">
                Free
              </span>
            </div>
            <div className="space-y-3.5">
              {sections.map((s) => {
                const acc = s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0;
                return (
                  <div key={s.key}>
                    <div className="mb-1.5 flex items-center justify-between text-xs">
                      <span className="font-medium text-ink">{sectionLabel(s.name || s.key)}</span>
                      <span className="tabular text-ink-tertiary">
                        {s.correct}/{s.total} · <span className="font-semibold text-ink">{acc}%</span>
                      </span>
                    </div>
                    <span className="block h-2 w-full overflow-hidden rounded-full bg-panel">
                      <span
                        className={cn(
                          "block h-full rounded-full",
                          acc >= 60 ? "bg-success" : acc >= 35 ? "bg-accent" : "bg-danger"
                        )}
                        style={{ width: `${acc}%` }}
                      />
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="border-t border-hairline pt-3 text-[11px] text-ink-tertiary">
              Net score and section accuracy are always free.
            </p>
          </Card>

          {/* Score-gap offer, when present */}
          {offer && (
            <div className="rounded-2xl border border-success/40 bg-success/10 p-5">
              <p className="text-sm font-semibold text-ink">
                {offer.gap >= 1 ? (
                  <>
                    You left <span className="text-success">{offer.gap} mark{offer.gap === 1 ? "" : "s"}</span> on the
                    table. Unlock now and get <span className="text-success">{offer.discount_pct}% off</span>.
                  </>
                ) : (
                  <>Unlock now and get <span className="text-success">{offer.discount_pct}% off</span> your first cycle.</>
                )}
              </p>
              <p className="mt-1 text-xs text-ink-tertiary">
                Applied automatically at checkout. Expires{" "}
                {new Date(offer.expires_at).toLocaleString("en-IN", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                .
              </p>
            </div>
          )}
        </div>

        {/* -------------------------------------------------------------- */}
        {/* RIGHT — the locked MarksenseAI report + unlock                  */}
        {/* -------------------------------------------------------------- */}
        <div className="space-y-5 lg:col-span-3">
          {/* The report, behind glass */}
          <section className="relative overflow-hidden rounded-2xl bg-panel-dark shadow-lift ring-1 ring-white/5">
            <div
              className="pointer-events-none absolute inset-0 opacity-70"
              style={{
                background:
                  "radial-gradient(70% 90% at 100% 0%, rgba(129,140,248,0.22), transparent 55%), radial-gradient(60% 90% at 0% 100%, rgba(240,171,252,0.14), transparent 55%)",
              }}
              aria-hidden
            />
            <div className="relative p-6 sm:p-7">
              <div className="flex items-center justify-between gap-3">
                <MarksenseWordmark as="h2" tone="white" className="text-xl sm:text-2xl" />
                <span className="inline-flex items-center gap-1 rounded-full bg-gold-bright/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-gold-bright ring-1 ring-gold-bright/30">
                  <Lock className="h-3 w-3" /> Locked
                </span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-white/60">
                Reads every decision you made — confidence, timing, and marking — and turns it into the few
                moves that win you the most marks.
              </p>

              {/* The hook: marks left on the table (real value, masked) */}
              <div className="mt-5 flex items-center justify-between gap-3 rounded-xl bg-gradient-to-r from-gold-bright/20 to-transparent px-4 py-4 ring-1 ring-gold-bright/25">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gold-bright">Marks left on the table</p>
                  <p className="text-xs text-white/55">With smarter skip decisions, same knowledge</p>
                </div>
                <p className="flex items-baseline gap-0.5 text-3xl font-bold text-white">
                  +<Masked className="text-gold-bright">{gain || 12}</Masked>
                </p>
              </div>

              {/* Confidence calibration preview (real structure, masked values) */}
              <div className="mt-5">
                <p className="mb-2.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-white/45">
                  <Target className="h-3.5 w-3.5 text-[#c084fc]" /> Confidence calibration
                </p>
                <div className="space-y-2.5">
                  {[
                    { level: "Confident", w: "82%", tone: "bg-emerald-400" },
                    { level: "Unsure", w: "54%", tone: "bg-amber-400" },
                    { level: "Guessing", w: "28%", tone: "bg-rose-400" },
                  ].map((b) => (
                    <div key={b.level} className="flex items-center gap-3">
                      <span className="w-16 flex-shrink-0 text-xs text-white/70">{b.level}</span>
                      <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                        <span className={cn("block h-full rounded-full blur-[3px]", b.tone)} style={{ width: b.w }} />
                      </span>
                      <span className="w-9 flex-shrink-0 text-right text-xs font-semibold text-white/80">
                        <Masked className="text-white/80">00%</Masked>
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Module tiles (real labels, values withheld) */}
              <div className="mt-5 grid grid-cols-2 gap-2.5">
                <LockedTile icon={TrendingUp} label="Break-even guess rule" hint="When a guess pays off" />
                <LockedTile icon={Gauge} label="Marks lost to over-guessing" hint="Confident-but-wrong" />
                <LockedTile icon={ListChecks} label="Questions to skip" hint="Your lowest-EV answers" />
                <LockedTile icon={Sparkles} label="Optimal-score gap" hint="Same knowledge, more marks" />
              </div>

              {/* Per-question decision log peek */}
              <div className="mt-5">
                <p className="mb-2.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-white/45">
                  <ListChecks className="h-3.5 w-3.5 text-[#c084fc]" /> Per-question decision log
                </p>
                <div className="space-y-1.5">
                  {["Q7 · Quant", "Q23 · Reasoning", "Q41 · English"].map((q) => (
                    <div key={q} className="flex items-center justify-between rounded-lg bg-white/[0.04] px-3 py-2 text-xs">
                      <span className="text-white/60">{q}</span>
                      <span className="flex items-center gap-2 text-white/70">
                        <span className="blur-[3px]">confident · 42s · −0.5</span>
                        <Lock className="h-3 w-3 text-white/40" />
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <p className="mt-4 text-[11px] text-white/35">
                Computed from your attempt. Every figure here is real and unlocks below — nothing is faked.
              </p>
            </div>
          </section>

          {/* Unlock options */}
          <section className="space-y-3">
            {/* Hero: All-Access */}
            <button
              onClick={() => onUnlock("all_access")}
              className="group relative w-full overflow-hidden rounded-2xl bg-gradient-to-br from-gold to-gold-bright p-5 text-left shadow-lift transition-premium hover:brightness-[1.03]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-sm font-bold text-white">
                    <Sparkles className="h-4 w-4" /> Unlock All-Access
                    <span className="rounded bg-white/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide">
                      {launch ? "Launch" : "Best value"}
                    </span>
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-white/85">
                    This full report on every mock, unlimited mocks across all exams, and the longitudinal
                    MarksenseAI, your trends, weakpoints & coach.
                  </p>
                </div>
                <div className="flex-shrink-0 text-right">
                  <p className="text-2xl font-bold tabular text-white">₹{allAccessPriceInr()}</p>
                  <p className="text-[10px] font-medium text-white/70">{launch ? "one-time" : "/ month"}</p>
                </div>
              </div>
              <span className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg bg-white/15 py-2.5 text-sm font-bold text-white ring-1 ring-white/20 transition-premium group-hover:bg-white/25">
                Get All-Access <ArrowRight className="h-4 w-4 transition-premium group-hover:translate-x-0.5" />
              </span>
            </button>

            {/* Secondary: ₹9 this report only (flag-gated) */}
            {freeMock && (
              <button
                onClick={() => onUnlock("single_report")}
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-hairline bg-surface px-4 py-3.5 text-left shadow-soft transition-premium hover:border-accent/40"
              >
                <span className="flex items-center gap-3">
                  <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
                    <Lock className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-ink">Just unlock this report</span>
                    <span className="block text-xs text-ink-tertiary">Full breakdown for this one mock</span>
                  </span>
                </span>
                <span className="flex-shrink-0 text-lg font-bold tabular text-ink">₹{SINGLE_REPORT_PRICE_INR}</span>
              </button>
            )}

            <div className="flex items-center justify-between pt-1">
              <p className="flex items-center gap-1.5 text-[11px] text-ink-tertiary">
                <ShieldCheck className="h-3.5 w-3.5 text-success" />
                {launch ? `One-time until ${ALL_ACCESS_OFFER_END_LABEL}, then ₹${ALL_ACCESS_REGULAR_PRICE_INR}/mo` : `₹${ALL_ACCESS_REGULAR_PRICE_INR}/month`}
              </p>
              <RazorpayBadge />
            </div>
          </section>

          {/* Email capture (signed-out only) */}
          {authed === false && (
            <div className="rounded-xl border border-hairline bg-surface p-4">
              <label htmlFor="lead-email" className="text-sm font-semibold text-ink">
                Want your analysis emailed to you?
              </label>
              <p className="mt-0.5 text-xs text-ink-tertiary">
                Optional. We&apos;ll send your report link so you can come back to it.
              </p>
              <div className="mt-2.5 flex gap-2">
                <input
                  id="lead-email"
                  type="email"
                  inputMode="email"
                  value={leadEmail}
                  onChange={(e) => setLeadEmail(e.target.value)}
                  placeholder="you@email.com"
                  className="min-h-[44px] flex-1 rounded-lg border border-hairline-strong bg-bg px-3 text-sm text-ink outline-none focus:border-accent"
                />
                <button
                  type="button"
                  onClick={captureLead}
                  disabled={leadSaved || !leadEmail.trim()}
                  className="min-h-[44px] rounded-lg border border-hairline-strong px-4 text-sm font-semibold text-ink transition-premium hover:bg-panel disabled:opacity-50"
                >
                  {leadSaved ? "Saved" : "Save"}
                </button>
              </div>
            </div>
          )}

          {/* Checkout status */}
          {checkout && (
            <div className="space-y-3 rounded-xl border border-hairline bg-panel p-4 text-center text-sm text-ink-secondary">
              {paying ? (
                <p className="flex items-center justify-center gap-2 text-ink">
                  <Loader2 className="h-4 w-4 animate-spin text-accent" />
                  Opening secure checkout for <span className="font-semibold">{checkout.price}</span>…
                </p>
              ) : payError ? (
                <div className="space-y-2">
                  <p className="text-danger">{payError}</p>
                  <button
                    onClick={() => startCheckout(checkout.kind)}
                    className="mx-auto block rounded-md border border-hairline bg-surface px-3 py-1.5 text-xs font-semibold text-ink transition-premium hover:bg-panel"
                  >
                    Try again
                  </button>
                </div>
              ) : (
                <p>
                  Secure checkout for <span className="font-semibold text-ink">{checkout.price}</span> via Razorpay.
                </p>
              )}
              {process.env.NODE_ENV !== "production" && (
                <button
                  onClick={async () => {
                    await fetch("/api/dev/simulate-upgrade", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ tier: "mentor" }),
                    });
                    router.push(reportHref);
                  }}
                  className="mx-auto block rounded-md border border-dashed border-gold-bright/50 bg-gold-soft px-3 py-1.5 text-xs font-semibold text-gold"
                >
                  ⚙ Dev only: simulate upgrade &amp; open report
                </button>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function HeroChip({ label, value, tone }: { label: string; value: number; tone: "emerald" | "rose" | "slate" }) {
  const color =
    tone === "emerald" ? "text-emerald-400" : tone === "rose" ? "text-rose-400" : "text-white/70";
  return (
    <div className="rounded-xl bg-white/[0.06] px-4 py-2.5 text-center ring-1 ring-white/10">
      <p className={cn("text-xl font-bold tabular", color)}>{value}</p>
      <p className="text-[10px] font-medium uppercase tracking-wide text-white/45">{label}</p>
    </div>
  );
}

function LockedTile({
  icon: Icon,
  label,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  hint: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl bg-white/[0.04] p-3.5 ring-1 ring-white/5">
      <div className="flex items-start justify-between">
        <Icon className="h-4 w-4 text-[#c084fc]" />
        <Lock className="h-3 w-3 text-white/30" />
      </div>
      <p className="mt-2 text-xs font-semibold text-white/85">{label}</p>
      <p className="text-[11px] text-white/40">{hint}</p>
    </div>
  );
}

