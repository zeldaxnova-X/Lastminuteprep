"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand-logo";
import { RazorpayBadge } from "@/components/payments/razorpay-badge";
import { sectionLabel } from "@/lib/cbt-questions";
import { cn } from "@/lib/utils";
import { Loader2, Lock, Sparkles, ShieldCheck } from "lucide-react";
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
  result: { net_score: number; section_breakdown: SectionRow[] } | null;
  teaseGain: number;
  maxScore: number;
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
  const max = data?.maxScore || 40;
  const sections = data?.result?.section_breakdown ?? [];
  const gain = data?.teaseGain ?? 0;

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <header className="border-b border-hairline">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <BrandLogo />
          <Link href="/dashboard" className="text-sm text-ink-secondary transition-premium hover:text-ink">
            Dashboard
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-lg flex-1 space-y-6 px-4 py-10 sm:px-6">
        {/* Scoreboard, plain and honest */}
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-tertiary">
            Sample complete
          </p>
          <h1 className="mt-2 font-report text-5xl font-semibold tracking-tight text-ink">
            <span className="text-accent tabular">{net}</span>
            <span className="text-ink-tertiary"> / {max}</span>
          </h1>
          <p className="mt-2 text-sm text-ink-secondary">
            That&apos;s your real net score. Here&apos;s what the full report would
            show you.
          </p>
        </div>

        {/* FREE: your section accuracy (real values, from your own attempt). */}
        <Card className="space-y-3 p-6">
          <p className="text-sm font-semibold text-ink">Your section accuracy</p>
          <div className="space-y-2.5">
            {sections.map((s) => {
              const acc = s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0;
              return (
                <div key={s.key} className="rounded-lg border border-hairline bg-panel px-3.5 py-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-ink">{sectionLabel(s.name || s.key)}</span>
                    <span className="text-sm font-semibold tabular text-ink">
                      {s.correct}/{s.total} · {acc}%
                    </span>
                  </div>
                  <span className="mt-1.5 block h-1.5 w-full overflow-hidden rounded-full bg-surface">
                    <span className="block h-full rounded-full bg-accent" style={{ width: `${acc}%` }} />
                  </span>
                </div>
              );
            })}
          </div>
          <p className="text-[11px] text-ink-tertiary">Net score and section accuracy are always free.</p>
        </Card>

        {/* LOCKED: the real MarksenseAI report layout, populated with YOUR attempt,
            values masked (never faked) until unlock. */}
        <Card className="relative space-y-4 overflow-hidden p-6">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
              <Sparkles className="h-4 w-4 text-gold" /> Your MarksenseAI report
            </p>
            <span className="flex items-center gap-1 rounded-md bg-gold-soft px-2 py-0.5 text-[11px] font-bold text-gold">
              <Lock className="h-3 w-3" /> Unlock ₹{allAccessPriceInr()}
            </span>
          </div>
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-3 rounded-xl border border-gold-bright/30 bg-gold-soft px-4 py-3.5">
              <span className="text-sm text-ink">You could have scored</span>
              <span className="text-sm font-bold text-gold">+<Masked className="text-gold">{gain}</Masked> marks</span>
            </div>
            {[
              "Marks lost to confident-but-wrong answers",
              "Your personal break-even guess rule",
              "Questions you should have skipped",
              "Optimal-score gap, same knowledge",
            ].map((label) => (
              <div key={label} className="flex items-center justify-between gap-3 rounded-lg border border-hairline bg-panel px-3.5 py-2.5">
                <span className="text-sm text-ink-secondary">{label}</span>
                <span className="rounded-md bg-surface px-2.5 py-1 text-sm font-semibold text-ink"><Masked>00</Masked></span>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-ink-tertiary">Computed from your attempt. Values unlock with All-Access.</p>
        </Card>

        <p className="text-center text-[11px] text-ink-tertiary">
          Scored under SSC CGL&apos;s +2 / <span className="text-danger">−0.5</span> marking.
        </p>

        {/* Score-gap offer: sized by the gap MarksenseAI found, applied at checkout */}
        {offer && (
          <div className="rounded-xl border border-success/40 bg-success/10 px-4 py-3.5">
            <p className="text-sm font-semibold text-ink">
              {offer.gap >= 1 ? (
                <>
                  You left <span className="text-success">{offer.gap} mark{offer.gap === 1 ? "" : "s"}</span> on the
                  table. Unlock MarksenseAI now and get{" "}
                  <span className="text-success">{offer.discount_pct}% off</span> your first cycle.
                </>
              ) : (
                <>
                  Unlock MarksenseAI now and get{" "}
                  <span className="text-success">{offer.discount_pct}% off</span> your first cycle.
                </>
              )}
            </p>
            <p className="mt-1 text-xs text-ink-tertiary">
              Applied automatically at checkout. Offer expires{" "}
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

        {/* Email capture at the unlock step (optional to skip). */}
        {authed === false && (
          <div className="rounded-xl border border-hairline bg-surface p-4">
            <label htmlFor="lead-email" className="text-sm font-semibold text-ink">
              Want your analysis sent to you?
            </label>
            <p className="mt-0.5 text-xs text-ink-tertiary">
              Drop your email, optional. We&apos;ll send your report link so you can come back to it.
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

        {/* Two ways to unlock. All-Access / MarksenseAI is the hero; ₹9 unlocks
            just this attempt's report. */}
        <div className="space-y-3">
          <OfferRow
            title="All-Access — unlock MarksenseAI"
            price={`₹${allAccessPriceInr()}`}
            note={isLaunchOffer() ? `one-time · until ${ALL_ACCESS_OFFER_END_LABEL}` : "per month"}
            featured
            desc="Every exam, unlimited mocks, the full report on every attempt, and the MarksenseAI engine — your skip strategy, personal break-even guess rule, and score-maximisation plan across all your mocks."
            cta="Unlock All-Access"
            onClick={() => onUnlock("all_access")}
          />

          <button
            onClick={() => onUnlock("single_report")}
            className="flex w-full items-center justify-between gap-3 rounded-xl border border-hairline bg-surface px-4 py-3.5 text-left shadow-soft transition-premium hover:border-accent/40"
          >
            <span>
              <span className="block text-sm font-semibold text-ink">Just this report</span>
              <span className="block text-xs text-ink-tertiary">
                Full breakdown for this one mock only
              </span>
            </span>
            <span className="flex-shrink-0 text-sm font-bold text-ink">₹{SINGLE_REPORT_PRICE_INR}</span>
          </button>

          <p className="flex items-center justify-center gap-1.5 pt-1 text-center text-xs text-ink-tertiary">
            <ShieldCheck className="h-3.5 w-3.5 text-success" />
            {isLaunchOffer()
              ? `All-Access is one-time until ${ALL_ACCESS_OFFER_END_LABEL}, then ₹${ALL_ACCESS_REGULAR_PRICE_INR}/month. ₹${SINGLE_REPORT_PRICE_INR} unlocks this report only.`
              : `All-Access ₹${ALL_ACCESS_REGULAR_PRICE_INR}/month. ₹${SINGLE_REPORT_PRICE_INR} unlocks this report only.`}
          </p>
          <RazorpayBadge className="pt-1" />
        </div>

        {checkout && (
          <div className="space-y-3 rounded-xl border border-hairline bg-panel p-4 text-center text-sm text-ink-secondary">
            {paying ? (
              <p className="flex items-center justify-center gap-2 text-ink">
                <Loader2 className="h-4 w-4 animate-spin text-accent" />
                Opening secure checkout for{" "}
                <span className="font-semibold">{checkout.price}</span>…
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
                Secure checkout for{" "}
                <span className="font-semibold text-ink">{checkout.price}</span> via Razorpay.
              </p>
            )}
            {process.env.NODE_ENV !== "production" && (
              <button
                onClick={async () => {
                  // Dev shortcut: grant mentor so the full report opens (covers
                  // both the ₹9 and ₹49 paths for local testing).
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
      </main>
    </div>
  );
}

function OfferRow({
  title,
  price,
  strike,
  note,
  desc,
  cta,
  onClick,
  featured = false,
}: {
  title: string;
  price: string;
  strike?: string;
  note: string;
  desc: string;
  cta: string;
  onClick: () => void;
  featured?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl p-5",
        featured
          ? "bg-panel-dark ring-1 ring-gold-bright/40 shadow-lift"
          : "border border-hairline bg-surface shadow-soft"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className={cn("text-sm font-semibold", featured ? "text-white" : "text-ink")}>{title}</h3>
            {featured && (
              <span className="rounded-md bg-gold-bright/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gold-bright">
                All-Access
              </span>
            )}
          </div>
          <p className={cn("mt-1 text-xs leading-relaxed", featured ? "text-white/70" : "text-ink-secondary")}>
            {desc}
          </p>
        </div>
        <div className="flex-shrink-0 text-right">
          <p className={cn("flex items-baseline justify-end gap-1.5 text-xl font-semibold tracking-tight tabular", featured ? "text-white" : "text-ink")}>
            {strike && (
              <span className={cn("text-sm font-medium line-through", featured ? "text-white/40" : "text-ink-tertiary")}>
                {strike}
              </span>
            )}
            {price}
          </p>
          <p className={cn("text-[10px] font-medium", featured ? "text-white/50" : "text-ink-tertiary")}>{note}</p>
        </div>
      </div>
      {featured ? (
        <button
          onClick={onClick}
          className="mt-4 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg bg-gold-bright px-4 py-2 text-sm font-semibold text-white transition-premium hover:bg-gold"
        >
          <Sparkles className="h-4 w-4" />
          {cta}
        </button>
      ) : (
        <Button onClick={onClick} variant="secondary" size="md" className="mt-4 w-full">
          {cta}
        </Button>
      )}
    </div>
  );
}
