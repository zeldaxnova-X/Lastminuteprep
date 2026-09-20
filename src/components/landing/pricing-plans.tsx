"use client";

import Link from "next/link";
import { Check, ArrowRight, Sparkles } from "lucide-react";
import {
  allAccessPriceInr,
  isLaunchOffer,
  ALL_ACCESS_REGULAR_PRICE_INR,
  ALL_ACCESS_OFFER_END_LABEL,
} from "@/lib/payments/pricing";

/* Two tiers: Free (one-time 20-question sample) and All-Access — a single pass
   that unlocks every exam AND MarksenseAI. Launch price ₹49 (struck against the
   regular ₹99 it reverts to on the offer end date); after that the launch badge
   and strike-through drop automatically (date-driven via pricing.ts). */

export function PricingPlans({ questionCount }: { questionCount: number }) {
  const qStr = questionCount.toLocaleString("en-IN");
  const price = allAccessPriceInr();
  const launch = isLaunchOffer();

  const allAccessFeatures = [
    "Every exam, current and upcoming",
    `${qStr}+ real questions · unlimited attempts`,
    "Full 100-question mocks & section drills",
    "Exact CBT interface, timer & palette",
    "Full report: accuracy, timing & section breakdown",
    "MarksenseAI: confidence calibration & skip strategy",
    "Your break-even guess rule under negative marking",
    "Optimal-score gap + improvement tracking",
  ];

  return (
    <div className="mx-auto grid max-w-3xl items-stretch gap-4 sm:grid-cols-2">
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

      {/* All-Access (featured) */}
      <div className="relative flex h-full flex-col overflow-hidden rounded-2xl bg-panel-dark p-6 text-white ring-1 ring-gold-bright/40 shadow-lift">
        <div className="pointer-events-none absolute inset-0 opacity-70" style={{ background: "radial-gradient(80% 55% at 85% 0%, rgba(217,119,6,0.16), transparent 60%)" }} aria-hidden />
        <div className="relative flex flex-1 flex-col">
          <div className="flex items-center justify-between gap-2">
            <h3 className="inline-flex items-center gap-1.5 text-base font-semibold text-white">
              <Sparkles className="h-4 w-4 text-gold-bright" /> All-Access
            </h3>
            {launch && (
              <span className="rounded-md bg-gold-bright/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gold-bright">
                Launch offer
              </span>
            )}
          </div>

          {/* price */}
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-5xl font-semibold tracking-tight tabular text-white">₹{price}</span>
            <span className="text-sm font-medium text-white/50">
              {launch ? "one-time · all exams" : "/ month · all exams"}
            </span>
          </div>
          <p className="mt-1 text-xs font-semibold text-gold-bright">
            {launch
              ? `Full access until ${ALL_ACCESS_OFFER_END_LABEL}. Then ₹${ALL_ACCESS_REGULAR_PRICE_INR}/month.`
              : "Every exam + MarksenseAI, billed monthly."}
          </p>

          {/* features */}
          <div className="mt-5 flex-1 space-y-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-white/45">Everything, included</p>
            {allAccessFeatures.map((f) => (
              <div key={f} className="flex gap-2.5 text-sm text-white/85">
                <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-gold-bright" />
                <span>{f}</span>
              </div>
            ))}
          </div>

          <Link
            href="/dashboard?checkout=allaccess"
            className="mt-6 inline-flex min-h-[46px] items-center justify-center gap-2 rounded-lg bg-gold-bright px-5 py-2.5 text-sm font-semibold text-white transition-premium hover:bg-gold"
          >
            Get All-Access, ₹{price}
            <ArrowRight className="h-4 w-4" />
          </Link>
          <p className="mt-3 text-center text-[11px] text-white/45">One pass. Every exam. MarksenseAI included.</p>
        </div>
      </div>
    </div>
  );
}

function Feature({ children, tone = "normal" }: { children: React.ReactNode; tone?: "muted" | "normal" | "strong" }) {
  return (
    <div
      className={`flex gap-2.5 text-sm ${tone === "strong" ? "font-semibold text-ink" : "text-ink-secondary"}`}
    >
      <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-success" />
      <span>{children}</span>
    </div>
  );
}
