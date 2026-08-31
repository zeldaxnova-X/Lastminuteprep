"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "./motion";

/* The one orchestrated "signature" moment on the page: the score-gap reveal.
   Counts the actual score up from 0→65, holds a beat, then the achievable
   score grows to 72 and the "+7 marks" delta lands. Everything else on the
   page stays quiet so this is the memorable beat. Fully static under
   prefers-reduced-motion. */

const CAL = [
  { level: "Confident", pct: 92, tone: "bg-success" },
  { level: "Unsure", pct: 61, tone: "bg-warning" },
  { level: "Guessed", pct: 18, tone: "bg-danger" },
];

const SCORED = 65;
const ACHIEVABLE = 72;

function tween(from: number, to: number, dur: number, on: (v: number) => void, done?: () => void) {
  const t0 = performance.now();
  const step = (t: number) => {
    const p = Math.min(1, (t - t0) / dur);
    const eased = 1 - Math.pow(1 - p, 3);
    on(Math.round(from + (to - from) * eased));
    if (p < 1) requestAnimationFrame(step);
    else done?.();
  };
  requestAnimationFrame(step);
}

export function SignatureGap() {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const started = useRef(false);
  const [scored, setScored] = useState(0);
  const [achiev, setAchiev] = useState(0);
  const [revealAchiev, setRevealAchiev] = useState(false);
  const [showDelta, setShowDelta] = useState(false);
  const [fillCal, setFillCal] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduced) {
      setScored(SCORED);
      setAchiev(ACHIEVABLE);
      setRevealAchiev(true);
      setShowDelta(true);
      setFillCal(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          setFillCal(true);
          tween(0, SCORED, 1100, setScored, () => {
            setTimeout(() => {
              setRevealAchiev(true);
              tween(0, ACHIEVABLE, 900, setAchiev, () => setShowDelta(true));
            }, 650);
          });
          io.disconnect();
        }
      },
      { threshold: 0.45 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [reduced]);

  return (
    <div
      ref={ref}
      className="rounded-2xl border border-hairline bg-surface p-6 shadow-soft sm:p-7"
    >
      {/* Score-gap bars */}
      <p className="text-xs font-semibold uppercase tracking-wider text-ink-tertiary">
        Optimal-score gap
      </p>
      <div className="mt-4 space-y-3">
        <GapBar label="You scored" value={scored} tone="bg-ink" />
        <GapBar
          label="Achievable"
          value={achiev}
          tone="bg-success"
          dim={!revealAchiev}
        />
      </div>
      <p
        className={cn(
          "mt-3 text-sm text-ink-secondary transition-all duration-500",
          showDelta ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1"
        )}
      >
        Same knowledge, smarter skip decisions, {" "}
        <span className="font-bold text-success">+{ACHIEVABLE - SCORED} marks</span>.
      </p>

      {/* Confidence calibration bars, fill once on scroll-in */}
      <div className="mt-6 border-t border-hairline pt-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-ink-tertiary">
          Confidence calibration
        </p>
        <div className="mt-3.5 space-y-3.5">
          {CAL.map((c, i) => (
            <div key={c.level}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="font-medium text-ink">{c.level}</span>
                <span className="tabular text-ink-tertiary">{c.pct}% correct</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-panel">
                <div
                  className={cn("h-full rounded-full transition-[width] duration-[900ms] ease-out", c.tone)}
                  style={{
                    width: fillCal ? `${c.pct}%` : "0%",
                    transitionDelay: `${i * 120}ms`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function GapBar({
  label,
  value,
  tone,
  dim = false,
}: {
  label: string;
  value: number;
  tone: string;
  dim?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-20 flex-shrink-0 text-[11px] text-ink-secondary">{label}</span>
      <div className="h-7 flex-1 overflow-hidden rounded-md bg-panel">
        <div
          className={cn(
            "flex h-full items-center justify-end rounded-md px-2 transition-opacity duration-300",
            tone,
            dim && "opacity-0"
          )}
          style={{ width: `${value}%` }}
        >
          <span className="text-xs font-bold tabular text-white">{value}</span>
        </div>
      </div>
    </div>
  );
}
