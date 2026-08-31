"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

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
    a: "It faithfully replicates the real computer-based test experience, the same five-state question palette, the same countdown timer, and the same free navigation and Save / Mark-for-Review controls. It isn't built from official software, but on exam day the flow will feel familiar.",
  },
  {
    q: "What exactly is the free sample?",
    a: "A one-time 20-question CBT in the real interface, tied to your account. You'll see your net score at the end. It doesn't include the full report, that's what the paid tiers unlock.",
  },
  {
    q: "What's the difference between Pro and MarksenseAI?",
    a: "Pro (₹19/month) gives you the practice and the proof: unlimited attempts on the full question bank and the complete performance report (accuracy, timing, section breakdown). MarksenseAI adds the decision engine on top: your exact skip strategy, your own break-even guess rule under negative marking, and your score-maximisation plan. Both cover every exam on the platform, current and upcoming.",
  },
  {
    q: "How much does it cost?",
    a: "Three tiers. Free is a one-time 20-question sample. Pro is ₹19/month for unlimited exams and the full report, without MarksenseAI. MarksenseAI is ₹99/month at launch and much less per month on longer plans: ₹249 quarterly, ₹399 half-yearly, or ₹599 a year (about ₹50/month). These are launch prices, locked in while you stay subscribed; the struck-through figure is the regular rate they rise to. Cancel anytime.",
  },
  {
    q: "Does one subscription cover every exam?",
    a: "Yes. Your MarksenseAI plan covers SSC CGL today and unlocks IBPS Clerk, SBI Clerk, NEET, JEE and UPSC the moment each goes live, no repurchase and no separate accounts.",
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
