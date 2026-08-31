"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "./motion";

/* The MarksenseAI cinematic intro: five full-height panels that fade and lift
   in as they enter view, over a single ambient background that shifts hue as
   you move between them. Deliberately built from CSS transforms/opacity and a
   gradient layer (no heavy canvas, no hard scroll-snap), so it stays smooth on
   the budget Android devices this audience skews toward. Under reduced motion
   it degrades to five plain stacked sections. */

const PANEL_TINTS = [
  "radial-gradient(60% 55% at 50% 40%, rgba(217,119,6,0.20), transparent 62%)",
  "radial-gradient(60% 55% at 30% 45%, rgba(79,70,229,0.22), transparent 62%)",
  "radial-gradient(65% 60% at 70% 40%, rgba(16,185,129,0.20), transparent 62%)",
  "radial-gradient(60% 55% at 40% 50%, rgba(124,58,237,0.20), transparent 62%)",
  "radial-gradient(70% 60% at 50% 45%, rgba(217,119,6,0.22), transparent 62%)",
];

export function MarksenseCinematic() {
  const [active, setActive] = useState(0);
  const reduced = useReducedMotion();
  const panelRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (reduced) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            const idx = Number((e.target as HTMLElement).dataset.index);
            setActive(idx);
          }
        });
      },
      { threshold: 0.5 }
    );
    panelRefs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, [reduced]);

  return (
    <div className="relative bg-panel-dark">
      {/* Shared ambient background: sticky so it persists while panels scroll
          over it, hue shifting to the active panel. */}
      {!reduced && (
        <div className="pointer-events-none sticky top-0 -mb-[100vh] h-screen" aria-hidden>
          <div
            className="absolute inset-0 transition-[background] duration-[900ms] ease-out"
            style={{ background: PANEL_TINTS[active] }}
          />
        </div>
      )}

      {PANELS.map((panel, i) => (
        <Panel
          key={i}
          index={i}
          reduced={reduced}
          active={active === i}
          setRef={(el) => (panelRefs.current[i] = el)}
        >
          {panel}
        </Panel>
      ))}
    </div>
  );
}

function Panel({
  index,
  active,
  reduced,
  setRef,
  children,
}: {
  index: number;
  active: boolean;
  reduced: boolean;
  setRef: (el: HTMLDivElement | null) => void;
  children: React.ReactNode;
}) {
  return (
    <div
      ref={setRef}
      data-index={index}
      className={cn(
        "relative z-10 flex min-h-[92vh] items-center justify-center px-5 py-16 sm:px-6",
        reduced && "min-h-0 border-b border-white/10 py-20"
      )}
    >
      <div
        className={cn(
          "w-full max-w-3xl text-center",
          !reduced && "transition-all duration-700 ease-out",
          !reduced && (active ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0")
        )}
      >
        {children}
      </div>
    </div>
  );
}

/* ---- Panel content ---- */

const PANELS = [
  // 1. Naming beat
  <>
    <p className="text-sm font-medium uppercase tracking-[0.2em] text-white/50">Introducing</p>
    <p className="mt-3 font-report text-5xl font-medium tracking-tight text-white sm:text-7xl">
      Marksense
      <span className="bg-gradient-to-r from-gold-bright to-accent bg-clip-text text-transparent">AI</span>
    </p>
    <p className="mx-auto mt-5 max-w-md text-lg text-white/70">
      The intelligence behind every mark you earn.
    </p>
    <p className="mt-10 text-xs uppercase tracking-[0.2em] text-white/30">Scroll</p>
  </>,

  // 2. The mechanism
  <>
    <h2 className="font-report text-4xl font-medium tracking-tight text-white sm:text-5xl">
      It sees beyond right and wrong.
    </h2>
    <p className="mx-auto mt-4 max-w-xl text-lg text-white/70">
      It reads your confidence, your timing, your choices, and the marks behind them.
    </p>
    <div className="mx-auto mt-9 max-w-md">
      <ConfidenceCard />
    </div>
  </>,

  // 3. The signature moment
  <>
    <h2 className="font-report text-4xl font-medium tracking-tight text-white sm:text-5xl">
      It finds what you can&apos;t see.
    </h2>
    <div className="mx-auto mt-9 max-w-md">
      <ScoreReveal />
    </div>
  </>,

  // 4. The output
  <>
    <h2 className="font-report text-4xl font-medium tracking-tight text-white sm:text-5xl">
      Then it shows you exactly how to improve.
    </h2>
    <div className="mx-auto mt-9 max-w-md">
      <MentorPlan />
    </div>
  </>,

  // 5. Close
  <>
    <h2 className="font-report text-4xl font-medium tracking-tight text-white sm:text-6xl">
      Not more study. Smarter decisions.
    </h2>
    <p className="mt-6 text-2xl font-semibold text-white">
      Marksense<span className="bg-gradient-to-r from-gold-bright to-accent bg-clip-text text-transparent">AI</span>.
      Better marks.
    </p>
    <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
      <Link
        href="/sample"
        className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-lg bg-white px-6 py-3 text-base font-semibold text-ink transition-premium hover:bg-white/90"
      >
        Try a free mock
        <ArrowRight className="h-4 w-4" />
      </Link>
      <a
        href="#plans"
        className="inline-flex min-h-[48px] items-center justify-center rounded-lg border border-white/25 px-6 py-3 text-base font-semibold text-white transition-premium hover:border-white/50"
      >
        View plans
      </a>
    </div>
  </>,
];

function ConfidenceCard() {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-5 text-left">
      <p className="text-xs font-semibold uppercase tracking-wider text-white/40">Question 24</p>
      <p className="mt-2 text-sm text-white/90">
        A train covers 240 km at a uniform speed. Had the speed been 12 km/h more, it would have taken 1 hour less. Find the speed.
      </p>
      <div className="mt-4 space-y-2">
        {["40 km/h", "48 km/h", "60 km/h", "54 km/h"].map((o, i) => (
          <div
            key={o}
            className={cn(
              "rounded-lg border px-3 py-2 text-sm",
              i === 1 ? "border-success/60 bg-success/10 text-white" : "border-white/10 text-white/70"
            )}
          >
            {o}
          </div>
        ))}
      </div>
      <div className="mt-4 border-t border-white/10 pt-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-white/40">How sure are you?</p>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {["Guessed", "Unsure", "Confident"].map((c, i) => (
            <span
              key={c}
              className={cn(
                "rounded-md px-2 py-1.5 text-center text-xs font-medium",
                i === 2 ? "bg-gold-bright/20 text-gold-bright ring-1 ring-gold-bright/40" : "bg-white/5 text-white/60"
              )}
            >
              {c}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

const ACTUAL = 65;
const ACHIEVABLE = 72.5;

function tween(from: number, to: number, dur: number, on: (v: number) => void, done?: () => void) {
  const t0 = performance.now();
  const step = (t: number) => {
    const p = Math.min(1, (t - t0) / dur);
    const eased = 1 - Math.pow(1 - p, 3);
    on(from + (to - from) * eased);
    if (p < 1) requestAnimationFrame(step);
    else done?.();
  };
  requestAnimationFrame(step);
}

function ScoreReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const started = useRef(false);
  const [score, setScore] = useState(0);
  const [showGain, setShowGain] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduced) {
      setScore(ACHIEVABLE);
      setShowGain(true);
      return;
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting && !started.current) {
          started.current = true;
          tween(0, ACTUAL, 1200, setScore, () => {
            setTimeout(() => {
              setShowGain(true);
              tween(ACTUAL, ACHIEVABLE, 900, setScore);
            }, 700);
          });
          io.disconnect();
        }
      },
      { threshold: 0.5 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [reduced]);

  return (
    <div ref={ref} className="rounded-2xl border border-white/10 bg-white/[0.05] p-6">
      <p className="text-xs font-semibold uppercase tracking-wider text-white/40">Your mock</p>
      <div className="mt-2 flex items-end justify-center gap-1">
        <span className="font-report text-6xl font-semibold tabular text-white">
          {score.toFixed(1)}
        </span>
        <span className="mb-2 text-lg text-white/40">/ 100</span>
      </div>
      <div
        className={cn(
          "mt-4 flex items-center justify-center gap-2 transition-all duration-500",
          showGain ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1"
        )}
      >
        <span className="rounded-full bg-success/15 px-3 py-1 text-sm font-bold text-success">
          +{(ACHIEVABLE - ACTUAL).toFixed(1)}
        </span>
        <span className="text-sm text-white/70">
          Achievable {ACHIEVABLE.toFixed(1)} / 100
        </span>
      </div>
      <p className="mt-4 text-center text-xs text-white/50">
        Same knowledge. Smarter decisions.
      </p>
    </div>
  );
}

function MentorPlan() {
  const items = [
    "Skip these 6 questions next time. They cost you 4 marks.",
    "Attempt English before Quant: your accuracy holds longer.",
    "Guess only when you can rule out 2 options, not before.",
  ];
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-5 text-left">
      <p className="text-xs font-semibold uppercase tracking-wider text-gold-bright/80">Your plan</p>
      <div className="mt-3 space-y-2.5">
        {items.map((t) => (
          <div key={t} className="flex gap-2.5 text-sm text-white/85">
            <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-gold-bright" />
            <span>{t}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-lg bg-white/5 px-4 py-2.5 text-center text-sm font-semibold text-white">
        Start next mock
      </div>
    </div>
  );
}
