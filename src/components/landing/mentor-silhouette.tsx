"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "./motion";

// Illustrative shapes for a MARKETING mock of the report, not a user's data.
// (The real, per-user values live behind the paywall on the conversion screen.)
const ROWS = [
  { label: "General Awareness", v: "9.5" },
  { label: "Quantitative Aptitude", v: "5.5" },
  { label: "Reasoning", v: "6.5" },
  { label: "English", v: "7.0" },
];

/**
 * A live report silhouette: the values render sharp, then "seal" (blur) after a
 * beat, previewing the paywall mechanic. Under reduced motion it renders
 * already-sealed (no animation).
 */
export function MentorSilhouette() {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const [sealed, setSealed] = useState(false);

  useEffect(() => {
    if (reduced) {
      setSealed(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    let timer: ReturnType<typeof setTimeout>;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          timer = setTimeout(() => setSealed(true), 1150);
          io.disconnect();
        }
      },
      { threshold: 0.4 }
    );
    io.observe(el);
    return () => {
      io.disconnect();
      clearTimeout(timer);
    };
  }, [reduced]);

  const seal = sealed ? "blur-[5px]" : "blur-0";

  return (
    <div
      ref={ref}
      className="relative overflow-hidden rounded-3xl bg-panel-dark p-6 ring-1 ring-white/10 sm:p-7"
    >
      {/* faint gold wash */}
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(70% 60% at 90% 0%, rgba(217,119,6,0.16), transparent 60%)",
        }}
        aria-hidden
      />

      <div className="relative">
        <div className="mb-5 flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-gold-bright">
            <Sparkles className="h-3.5 w-3.5" /> Your report
          </span>
          <span className="flex items-center gap-1 rounded-full bg-white/10 px-2 py-1 text-[10px] font-medium text-white/70">
            <Lock className="h-3 w-3" /> Locked
          </span>
        </div>

        <div className="space-y-2.5">
          {ROWS.map((r) => (
            <div
              key={r.label}
              className="flex items-center justify-between rounded-xl bg-white/[0.04] px-4 py-3 ring-1 ring-white/5"
            >
              <span className="text-sm text-white/80">{r.label}</span>
              <span
                className={cn(
                  "rounded-md bg-white/10 px-2.5 py-1 text-sm font-semibold tabular text-white transition-[filter] duration-500 ease-out select-none",
                  seal
                )}
                aria-hidden
              >
                {r.v}
              </span>
            </div>
          ))}
        </div>

        {/* Gold verdict */}
        <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-gold-bright/10 px-4 py-3.5 ring-1 ring-gold-bright/25">
          <p className="text-sm text-white">
            <Sparkles className="mr-1 inline h-4 w-4 text-gold-bright" />
            MarksenseAI: you could have scored{" "}
            <span className="font-bold text-gold-bright">
              +
              <span
                className={cn(
                  "transition-[filter] duration-500 ease-out select-none",
                  seal
                )}
                aria-hidden
              >
                7
              </span>
            </span>{" "}
            marks
          </p>
        </div>
        <p className="mt-3 text-center text-[11px] text-white/40">Illustrative preview</p>
      </div>
    </div>
  );
}
