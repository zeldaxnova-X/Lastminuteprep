"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/** True when the user asks for reduced motion, we then disable animation. */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}

/**
 * Scroll-triggered reveal (fade + rise) via IntersectionObserver. Renders
 * immediately and statically when reduced motion is requested.
 */
export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) {
      setVisible(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [reduced]);

  return (
    <div
      ref={ref}
      className={cn(
        reduced
          ? ""
          : "transition-[opacity,transform] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform",
        !reduced && (visible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"),
        className
      )}
      style={!reduced && visible ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}

/**
 * Count-up number that animates once on first view. Shows the final value
 * immediately under reduced motion. `format` overrides the default en-IN
 * grouping (e.g. for "10,000+").
 */
export function CountUp({
  end,
  duration = 1400,
  suffix = "",
  className,
  format,
}: {
  end: number;
  duration?: number;
  suffix?: string;
  className?: string;
  format?: (n: number) => string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  // Initialise to `end` so the real number is in the server-rendered markup
  // (never a literal "0" fallback); the count-up animates from 0 on first view.
  const [val, setVal] = useState(end);
  const reduced = useReducedMotion();
  const started = useRef(false);

  useEffect(() => {
    if (reduced) {
      setVal(end);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          setVal(0);
          const t0 = performance.now();
          const tick = (t: number) => {
            const p = Math.min(1, (t - t0) / duration);
            const eased = 1 - Math.pow(1 - p, 3);
            setVal(Math.round(end * eased));
            if (p < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
          io.disconnect();
        }
      },
      { threshold: 0.4 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [end, duration, reduced]);

  const display = format ? format(val) : val.toLocaleString("en-IN");
  return (
    <span ref={ref} className={cn("tabular", className)}>
      {display}
      {suffix}
    </span>
  );
}
