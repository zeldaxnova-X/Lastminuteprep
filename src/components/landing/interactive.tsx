"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  allAccessPriceInr,
  isLaunchOffer,
  ALL_ACCESS_REGULAR_PRICE_INR,
  ALL_ACCESS_OFFER_END_LABEL,
} from "@/lib/payments/pricing";

const AA_PRICE = allAccessPriceInr();

/* ---------------- Exam marquee ---------------- */

const MARQUEE = [
  { name: "SSC CGL", live: true },
  { name: "IBPS Clerk", live: false },
  { name: "SBI Clerk", live: false },
  { name: "NEET", live: false },
  { name: "JEE", live: false },
  { name: "UPSC", live: false },
];

/** Infinite horizontal scroll of exam names; SSC CGL carries a Live dot. */
export function ExamMarquee() {
  const items = [...MARQUEE, ...MARQUEE];
  return (
    <div
      className="relative overflow-hidden border-y border-hairline bg-panel/60 py-5"
      style={{
        maskImage:
          "linear-gradient(to right, transparent, #000 12%, #000 88%, transparent)",
        WebkitMaskImage:
          "linear-gradient(to right, transparent, #000 12%, #000 88%, transparent)",
      }}
      aria-hidden
    >
      <div className="marquee-track flex w-max items-center gap-12">
        {items.map((e, i) => (
          <div key={i} className="flex items-center gap-3 whitespace-nowrap">
            <span
              className={cn(
                "font-report text-2xl font-medium tracking-tight",
                e.live ? "text-ink" : "text-ink-tertiary"
              )}
            >
              {e.name}
            </span>
            {e.live ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent">
                <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                Live
              </span>
            ) : (
              <span className="rounded-full bg-panel px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-tertiary">
                Soon
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- FAQ accordion ---------------- */

const FAQS: { q: string; a: string }[] = [
  {
    q: "Is this the actual exam interface?",
    a: "It's a faithful replica, not official software. Same four 15-minute sectional locks, same five-state palette, same countdown, same Save and Mark-for-Review behaviour. We aren't affiliated with the Staff Selection Commission and we don't claim to be. What we can promise is that on exam day the flow won't be new to you.",
  },
  {
    q: "What exactly is the free sample?",
    a: "A one-time 20-question CBT in the real interface, tied to your account. You'll see your net score at the end. It doesn't include the full report, that's what the paid tiers unlock.",
  },
  {
    q: "What do I get with All-Access?",
    a: `Everything. One All-Access pass gives you unlimited attempts on the full question bank, the complete performance report (accuracy, timing, section breakdown), and the MarksenseAI decision engine on top: your exact skip strategy, your own break-even guess rule under negative marking, and your score-maximisation plan. It covers every exam on the platform, current and upcoming.`,
  },
  {
    q: "How much does it cost?",
    a: isLaunchOffer()
      ? `Two options. Free is a one-time 20-question sample. All-Access will be ₹${ALL_ACCESS_REGULAR_PRICE_INR}/month, but as an early-launch deal you pay ₹${AA_PRICE} once and get full access to every exam plus MarksenseAI until ${ALL_ACCESS_OFFER_END_LABEL}, no recurring charge during launch. After that, All-Access is ₹${ALL_ACCESS_REGULAR_PRICE_INR}/month.`
      : `Two options. Free is a one-time 20-question sample. All-Access is ₹${AA_PRICE}/month and unlocks every exam plus MarksenseAI, no separate tiers.`,
  },
  {
    q: "Does one pass cover every exam?",
    a: "Yes. Your All-Access pass covers SSC CGL today and unlocks IBPS Clerk, SBI Clerk, NEET, JEE and UPSC the moment each goes live, no repurchase and no separate accounts.",
  },
  {
    q: "Which exams are supported?",
    a: "SSC CGL Tier 1 is live now. IBPS Clerk and SBI Clerk are next, with NEET, JEE and UPSC on the roadmap, the engine is built to add them, and each is included in your subscription the day it launches.",
  },
  {
    q: "How does MarksenseAI actually help?",
    a: "It reads how confident you were on every question against how you actually did, then tells you which questions to skip, when a guess is worth the risk under negative marking, and the exact marks each decision was worth, across every attempt, so you can see yourself improve.",
  },
];

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="divide-y divide-hairline overflow-hidden rounded-2xl border border-hairline bg-surface shadow-soft">
      {FAQS.map((f, i) => {
        const isOpen = open === i;
        return (
          <div key={i}>
            <button
              onClick={() => setOpen(isOpen ? null : i)}
              aria-expanded={isOpen}
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-premium hover:bg-panel/60"
            >
              <span className="text-sm font-medium text-ink sm:text-[15px]">{f.q}</span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 flex-shrink-0 text-ink-tertiary transition-premium",
                  isOpen && "rotate-180 text-accent"
                )}
              />
            </button>
            {isOpen && (
              <div className="px-5 pb-5 text-sm leading-relaxed text-ink-secondary">
                {f.a}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
