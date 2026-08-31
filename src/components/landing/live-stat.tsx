"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "./motion";

/**
 * Live, animated question-bank counter. Server-renders the real `initial`
 * number, counts up from 0 the first time it scrolls into view, then polls
 * /api/stats/questions and smoothly tweens to any new value, so the metric
 * moves on its own as questions are added, without a page reload.
 */
export function LiveQuestionCount({
  initial,
  className,
  pollMs = 30000,
  duration = 1400,
}: {
  initial: number;
  className?: string;
  pollMs?: number;
  duration?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState(initial);
  const displayRef = useRef(initial);
  const targetRef = useRef(initial);
  const startedRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const reduced = useReducedMotion();

  const tweenTo = (to: number, dur: number) => {
    if (reduced) {
      displayRef.current = to;
      setDisplay(to);
      return;
    }
    const from = displayRef.current;
    if (from === to) return;
    const t0 = performance.now();
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      const v = Math.round(from + (to - from) * eased);
      displayRef.current = v;
      setDisplay(v);
      if (p < 1) rafRef.current = requestAnimationFrame(step);
    };
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(step);
  };

  // Count up from 0 on first view.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduced) {
      startedRef.current = true;
      setDisplay(targetRef.current);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !startedRef.current) {
          startedRef.current = true;
          displayRef.current = 0;
          setDisplay(0);
          tweenTo(targetRef.current, duration);
          io.disconnect();
        }
      },
      { threshold: 0.4 }
    );
    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced, duration]);

  // Poll for live updates and tween to the new total.
  useEffect(() => {
    let alive = true;
    const fetchCount = async () => {
      try {
        const r = await fetch("/api/stats/questions", { cache: "no-store" });
        if (!r.ok) return;
        const j = await r.json();
        const n = Number(j.questions);
        if (!alive || !Number.isFinite(n) || n === targetRef.current) return;
        targetRef.current = n;
        if (startedRef.current) tweenTo(n, 900);
      } catch {
        /* transient, keep the last good value */
      }
    };
    const id = setInterval(fetchCount, pollMs);
    return () => {
      alive = false;
      clearInterval(id);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pollMs]);

  return (
    <span ref={ref} className={cn("tabular", className)}>
      {display.toLocaleString("en-IN")}
    </span>
  );
}
