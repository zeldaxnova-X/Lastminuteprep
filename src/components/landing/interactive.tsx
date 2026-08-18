"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/* ---------------- Exam marquee ---------------- */

const MARQUEE = [
  { name: "SSC CGL", live: true },
  { name: "NEET", live: false },
  { name: "JEE", live: false },
  { name: "NEET PG", live: false },
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
    a: "It faithfully replicates the real computer-based test experience — the same five-state question palette, the same countdown timer, and the same free navigation and Save / Mark-for-Review controls. It isn't built from official software, but on exam day the flow will feel familiar.",
  },
  {
    q: "What exactly is the free sample?",
    a: "A one-time 20-question CBT in the real interface, tied to your account. You'll see your net score at the end. It doesn't include the full report — that's what the paid tiers unlock.",
  },
  {
    q: "What's the difference between ₹19/mo and ₹79/mo?",
    a: "Both are monthly plans with unlimited attempts on the full question bank. Pro (₹19/mo) gives you the full performance report — accuracy, timing, and section breakdown. AI Mentor (₹79/mo) adds the LastMilePrep Mentor Engine: your exact skip strategy, your own break-even guess rule under negative marking, and your score-maximisation plan.",
  },
  {
    q: "Why are the prices so low?",
    a: "They're honest founding prices while we're young — ₹19/mo for Pro and ₹79/mo for AI Mentor, with no fake struck-through 'discounts'. What you see is the real price you pay today; we may raise them as the product grows.",
  },
  {
    q: "Which exams are supported?",
    a: "SSC CGL Tier 1 is live now. NEET, JEE, NEET PG and UPSC are on the roadmap — the engine is built to add them, but they aren't available yet.",
  },
  {
    q: "How does the AI Mentor actually help?",
    a: "It reads how confident you were on every question against how you actually did, then tells you which questions to skip, when a guess is worth the risk under negative marking, and the exact marks each decision was worth — across every attempt, so you can see yourself improve.",
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
