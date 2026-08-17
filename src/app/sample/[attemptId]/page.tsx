"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand-logo";
import { sectionLabel } from "@/lib/cbt-questions";
import { cn } from "@/lib/utils";
import { Loader2, Lock, Sparkles, ShieldCheck } from "lucide-react";
import { startRazorpayCheckout, waitForPlanUpgrade } from "@/lib/payments/razorpay-checkout";

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

/** Real value concealed behind a blur — the exact figure revealed on unlock. */
function Masked({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <>
      <span aria-hidden className={cn("select-none blur-[6px]", className)}>
        {children}
      </span>
      <span className="sr-only">locked — unlock to reveal</span>
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
  const [checkout, setCheckout] = useState<null | { tier: "report" | "mentor"; price: string }>(null);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

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
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [attemptId]);

  // PAYWALL SEAM — auth is required to unlock, payment is NOT wired.
  // Not signed in → send to /login, returning to the report afterwards.
  // Signed in → stubbed checkout (// TODO: Razorpay). No plan mutation here.
  function onUnlock(tier: "report" | "mentor") {
    if (!authed) {
      router.push(`/login?next=${encodeURIComponent(reportHref)}`);
      return;
    }
    startCheckout(tier);
  }

  function startCheckout(tier: "report" | "mentor") {
    setCheckout({ tier, price: tier === "mentor" ? "₹49/mo" : "₹19/mo" });
    setPayError(null);
    setPaying(true);
    const plan = tier === "mentor" ? "mentor" : "pro";
    void startRazorpayCheckout({
      // UI "report" tier maps to the canonical "pro" plan.
      plan,
      prefill: email ? { email } : undefined,
      // Payment captured + signature verified. The plan is granted by the
      // webhook (independent of this callback), so wait for it to land before
      // sending the user to the now-unlocked report.
      onSuccess: async () => {
        const upgraded = await waitForPlanUpgrade(plan);
        if (upgraded) {
          router.push(reportHref);
        } else {
          setPaying(false);
          setPayError(
            "Payment received — we're confirming your upgrade. It'll unlock in a moment; refresh if it doesn't."
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
        {/* Scoreboard — plain and honest */}
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

        {/* Report silhouette — real structure, masked real values */}
        <Card className="space-y-4 p-6">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-ink">Section breakdown</p>
            <span className="flex items-center gap-1 text-[11px] font-medium text-ink-tertiary">
              <Lock className="h-3 w-3" /> ₹19
            </span>
          </div>
          <div className="space-y-2.5">
            {sections.map((s) => (
              <div
                key={s.key}
                className="flex items-center justify-between rounded-lg border border-hairline bg-panel px-3.5 py-2.5"
              >
                <span className="text-sm text-ink">{sectionLabel(s.name || s.key)}</span>
                <span className="rounded-md bg-surface px-2.5 py-1 text-sm font-semibold tabular text-ink">
                  <Masked>{s.netScore}</Masked>
                </span>
              </div>
            ))}
          </div>

          {/* One hero Mentor verdict, in full, with a masked real value (gold). */}
          <div className="flex items-center justify-between gap-3 rounded-xl border border-gold-bright/30 bg-gold-soft px-4 py-3.5">
            <p className="text-sm text-ink">
              <Sparkles className="mr-1 inline h-4 w-4 text-gold" />
              AI Mentor: you could have scored{" "}
              <span className="font-bold text-gold">
                +<Masked className="text-gold">{gain}</Masked>
              </span>{" "}
              marks
            </p>
            <span className="flex flex-shrink-0 items-center gap-1 text-[11px] font-medium text-ink-tertiary">
              <Lock className="h-3 w-3" /> ₹49
            </span>
          </div>
        </Card>

        {/* The calm offer */}
        <div className="space-y-3">
          <OfferRow
            title="Pro — full report"
            price="₹19/mo"
            note="Founding price"
            desc="Unlock every section score, accuracy, and timing breakdown — plus the full 10,000+ question bank."
            cta="Unlock report"
            onClick={() => onUnlock("report")}
          />
          <OfferRow
            title="AI Mentor — report + engine"
            price="₹49/mo"
            note="Founding price"
            featured
            desc="Everything above, plus the exact skip strategy, your own break-even guess rule, and your score-maximisation plan."
            cta="Unlock report + Mentor"
            onClick={() => onUnlock("mentor")}
          />
          <p className="flex items-center justify-center gap-1.5 pt-1 text-center text-xs text-ink-tertiary">
            <ShieldCheck className="h-3.5 w-3.5 text-success" />
            Honest founding prices — no fake discounts. Cancel anytime.
          </p>
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
                  onClick={() => startCheckout(checkout.tier)}
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
                  await fetch("/api/dev/simulate-upgrade", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ tier: checkout.tier === "mentor" ? "mentor" : "pro" }),
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
  note,
  desc,
  cta,
  onClick,
  featured = false,
}: {
  title: string;
  price: string;
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
                Mentor
              </span>
            )}
          </div>
          <p className={cn("mt-1 text-xs leading-relaxed", featured ? "text-white/70" : "text-ink-secondary")}>
            {desc}
          </p>
        </div>
        <div className="flex-shrink-0 text-right">
          <p className={cn("text-xl font-semibold tracking-tight tabular", featured ? "text-white" : "text-ink")}>
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
