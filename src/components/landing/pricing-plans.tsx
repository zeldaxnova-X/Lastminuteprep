"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, ArrowRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

/* Three tiers: Free, Pro (exams + results, no MarksenseAI), and MarksenseAI
   (everything). The MarksenseAI plan varies only by duration, chosen with a
   segmented toggle. Launch prices are shown against the struck regular price
   they will rise to; monthly is the default, annual carries the deepest saving. */

type Duration = {
  id: string;
  label: string;
  price: number; // launch price charged now
  regular: number; // regular price it rises to
  months: number;
  tag?: string;
};

const DURATIONS: Duration[] = [
  { id: "monthly", label: "Monthly", price: 99, regular: 149, months: 1 },
  { id: "quarterly", label: "Quarterly", price: 249, regular: 349, months: 3, tag: "Most popular" },
  { id: "halfyearly", label: "Half-yearly", price: 399, regular: 599, months: 6 },
  { id: "annual", label: "Annual", price: 599, regular: 999, months: 12, tag: "Best value" },
];

const MONTHLY_BASE = 99;
const perMonth = (d: Duration) => Math.round(d.price / d.months);
const savingPct = (d: Duration) => (d.months === 1 ? 0 : Math.round((1 - perMonth(d) / MONTHLY_BASE) * 100));

export function PricingPlans({ questionCount }: { questionCount: number }) {
  const [durId, setDurId] = useState("monthly"); // monthly takes priority
  const dur = DURATIONS.find((d) => d.id === durId) ?? DURATIONS[0];
  const qStr = questionCount.toLocaleString("en-IN");

  const proFeatures = [
    "Access to every exam, current and upcoming",
    `${qStr}+ real questions · unlimited attempts`,
    "Full 100-question mocks & section drills",
    "Exact CBT interface, timer & palette",
    "Full report: accuracy, timing & section breakdown",
  ];
  const marksenseFeatures = [
    "Confidence calibration (where you were sure but wrong)",
    "Exact skip strategy under negative marking",
    "Your personal break-even guess rule",
    "Optimal-score gap: same knowledge, +X marks",
    "Pacing & attempt-order analysis",
    "Section & topic weakness ranking",
    "Improvement tracking across every attempt",
  ];

  return (
    <div className="grid items-stretch gap-4 lg:grid-cols-3">
      {/* Free */}
      <div className="flex h-full flex-col rounded-2xl border border-hairline bg-surface p-6 shadow-soft">
        <h3 className="text-base font-semibold text-ink">Free</h3>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-4xl font-semibold tracking-tight tabular text-ink">₹0</span>
          <span className="text-xs font-medium text-ink-tertiary">one-time</span>
        </div>
        <p className="mt-1 text-xs text-ink-tertiary">No card. One exam.</p>
        <div className="mt-5 flex-1 space-y-2.5">
          {["20-question sample", "Exact CBT interface", "Your net score at the end"].map((r) => (
            <Feature key={r} tone="muted">{r}</Feature>
          ))}
        </div>
        <Link href="/sample" className="mt-6 inline-flex min-h-[46px] items-center justify-center rounded-lg border border-hairline-strong bg-surface px-5 py-2.5 text-sm font-semibold text-ink transition-premium hover:border-ink/30">
          Try free
        </Link>
      </div>

      {/* Pro */}
      <div className="flex h-full flex-col rounded-2xl border border-hairline bg-surface p-6 shadow-soft">
        <h3 className="text-base font-semibold text-ink">Pro</h3>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-4xl font-semibold tracking-tight tabular text-ink">₹19</span>
          <span className="text-sm font-medium text-ink-tertiary">/ month</span>
        </div>
        <p className="mt-1 text-xs font-semibold text-ink-tertiary">Practice + results. No MarksenseAI.</p>
        <div className="mt-5 flex-1 space-y-2.5">
          {proFeatures.map((r, i) => (
            <Feature key={r} tone={i === 0 ? "strong" : "normal"}>{r}</Feature>
          ))}
        </div>
        <Link href="/dashboard?checkout=pro:monthly" className="mt-6 inline-flex min-h-[46px] items-center justify-center rounded-lg border border-ink/15 bg-ink px-5 py-2.5 text-sm font-semibold text-white transition-premium hover:bg-ink/90">
          Get Pro
        </Link>
      </div>

      {/* MarksenseAI (featured, duration toggle) */}
      <div className="relative flex h-full flex-col overflow-hidden rounded-2xl bg-panel-dark p-6 text-white ring-1 ring-gold-bright/40 shadow-lift">
        <div className="pointer-events-none absolute inset-0 opacity-70" style={{ background: "radial-gradient(80% 55% at 85% 0%, rgba(217,119,6,0.16), transparent 60%)" }} aria-hidden />
        <div className="relative flex flex-1 flex-col">
          <div className="flex items-center justify-between gap-2">
            <h3 className="inline-flex items-center gap-1.5 text-base font-semibold text-white">
              <Sparkles className="h-4 w-4 text-gold-bright" /> MarksenseAI
            </h3>
            <span className="rounded-md bg-gold-bright/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gold-bright">
              Launch pricing
            </span>
          </div>

          {/* duration toggle */}
          <div className="mt-4 grid grid-cols-2 gap-1.5 rounded-xl bg-white/[0.06] p-1 ring-1 ring-white/10">
            {DURATIONS.map((d) => {
              const sel = d.id === durId;
              return (
                <button
                  key={d.id}
                  onClick={() => setDurId(d.id)}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1 rounded-lg px-2 py-2 text-xs font-semibold transition-premium",
                    sel ? "bg-white text-ink shadow-sm" : "text-white/60 hover:text-white/90"
                  )}
                >
                  <span>{d.label}</span>
                  {d.tag && (
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-[8px] font-bold uppercase leading-none tracking-wide",
                        d.tag === "Best value"
                          ? "bg-success/20 text-success"
                          : "bg-gold-bright/20 text-gold-bright"
                      )}
                    >
                      {d.tag}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* price */}
          <div className="mt-5 flex items-baseline gap-2">
            <span className="text-4xl font-semibold tracking-tight tabular text-white">₹{dur.price}</span>
            <span className="text-lg font-medium tabular text-white/35 line-through">₹{dur.regular}</span>
            <span className="text-sm font-medium text-white/50">
              {dur.months === 1 ? "/ mo" : `/ ${dur.months} mo`}
            </span>
          </div>
          <p className="mt-1 text-xs font-semibold text-gold-bright">
            {dur.months === 1
              ? "Launch price, locked while you stay subscribed"
              : `≈ ₹${perMonth(dur)}/mo · save ${savingPct(dur)}% vs monthly`}
          </p>

          {/* features */}
          <div className="mt-5 flex-1 space-y-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-white/45">Everything in Pro, plus</p>
            {marksenseFeatures.map((f) => (
              <div key={f} className="flex gap-2.5 text-sm text-white/85">
                <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-gold-bright" />
                <span>{f}</span>
              </div>
            ))}
          </div>

          <Link
            href={`/dashboard?checkout=mentor:${dur.id}`}
            className="mt-6 inline-flex min-h-[46px] items-center justify-center gap-2 rounded-lg bg-gold-bright px-5 py-2.5 text-sm font-semibold text-white transition-premium hover:bg-gold"
          >
            Get MarksenseAI
            <ArrowRight className="h-4 w-4" />
          </Link>
          <p className="mt-3 text-center text-[11px] text-white/45">One subscription. Every exam. Cancel anytime.</p>
        </div>
      </div>
    </div>
  );
}

function Feature({ children, tone = "normal" }: { children: React.ReactNode; tone?: "muted" | "normal" | "strong" }) {
  return (
    <div
      className={cn(
        "flex gap-2.5 text-sm",
        tone === "muted" ? "text-ink-secondary" : tone === "strong" ? "font-semibold text-ink" : "text-ink-secondary"
      )}
    >
      <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-success" />
      <span>{children}</span>
    </div>
  );
}
