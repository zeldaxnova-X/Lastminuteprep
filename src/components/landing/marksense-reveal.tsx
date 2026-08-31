"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "./motion";

/* MarksenseAI teaser reveal: a light-horizon beneath the wordmark. A soft arc
   with a bright focal bloom at its centre, a highlight that sweeps across it
   once on reveal (the visible "pop"), and a slow breathing glow so it always
   feels alive. The wordmark fades up gently. Plays on scroll-in; fully static
   under reduced motion. Pure CSS, no canvas. */
export function MarksenseReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  const reduced = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduced) {
      setOn(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setOn(true);
          io.disconnect();
        }
      },
      { threshold: 0.35 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [reduced]);

  return (
    <div ref={ref} className={cn("ms-reveal relative", on && "is-on", reduced && "is-reduced")}>
      <style>{CSS}</style>

      {/* wide ambient glow behind the wordmark */}
      <div
        className="ms-glow pointer-events-none absolute left-1/2 top-[46%] h-56 w-[150%] -translate-x-1/2 -translate-y-1/2"
        aria-hidden
      />

      <div className="relative flex flex-col items-center text-center">
        <p className="ms-intro text-xs font-semibold uppercase tracking-[0.24em] text-white/40">
          Introducing
        </p>

        <div className="ms-mark relative mt-2">
          <p className="ms-word relative font-report text-5xl font-medium tracking-tight text-white sm:text-6xl">
            Marksense
            <span className="bg-gradient-to-r from-[#f0abfc] via-[#c084fc] to-[#818cf8] bg-clip-text text-transparent">
              AI
            </span>
          </p>
          <Sparkle className="ms-spark ms-spark-1 absolute -right-3 -top-2" size={15} />
          <Sparkle className="ms-spark ms-spark-2 absolute -left-4 top-3" size={11} />
        </div>

        {/* light-horizon: arc + focal bloom + travelling sweep */}
        <div className="ms-horizon relative mt-0 h-16 w-full">
          <svg
            className="ms-arc absolute inset-0 h-full w-full"
            viewBox="0 0 1000 100"
            preserveAspectRatio="none"
            fill="none"
            aria-hidden
          >
            <defs>
              <linearGradient id="ms-arc-grad" x1="0" y1="0" x2="1000" y2="0" gradientUnits="userSpaceOnUse">
                <stop offset="0" stopColor="#818cf8" stopOpacity="0" />
                <stop offset="0.28" stopColor="#a78bfa" stopOpacity="0.55" />
                <stop offset="0.5" stopColor="#f5f3ff" stopOpacity="1" />
                <stop offset="0.72" stopColor="#a78bfa" stopOpacity="0.55" />
                <stop offset="1" stopColor="#818cf8" stopOpacity="0" />
              </linearGradient>
            </defs>
            {/* soft blurred halo */}
            <path
              d="M 30 78 Q 500 14 970 78"
              stroke="url(#ms-arc-grad)"
              strokeWidth="9"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
              style={{ filter: "blur(8px)" }}
            />
            {/* crisp bright line */}
            <path
              d="M 30 78 Q 500 14 970 78"
              stroke="url(#ms-arc-grad)"
              strokeWidth="1.75"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>

          {/* focal bloom where the arc peaks */}
          <div className="ms-bloom pointer-events-none absolute left-1/2 top-[16%] h-24 w-40 -translate-x-1/2 -translate-y-1/2" aria-hidden />

          {/* highlight that sweeps across the horizon once on reveal */}
          <div className="ms-sweep-track pointer-events-none absolute inset-0 overflow-hidden">
            <div className="ms-sweep absolute left-1/2 top-[18%] h-16 w-40 -translate-x-1/2 -translate-y-1/2" aria-hidden />
          </div>
        </div>

        <p className="ms-tag mt-3 max-w-md text-base text-white/70">
          Maximise your output from every attempt.
        </p>
      </div>
    </div>
  );
}

function Sparkle({ className, size = 13 }: { className?: string; size?: number }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 0c.6 6 5.4 10.8 12 12-6.6 1.2-11.4 6-12 12-.6-6-5.4-10.8-12-12C6.6 10.8 11.4 6 12 0Z"
        fill="#e9d5ff"
      />
    </svg>
  );
}

const CSS = `
.ms-reveal .ms-intro,
.ms-reveal .ms-word,
.ms-reveal .ms-tag,
.ms-reveal .ms-arc,
.ms-reveal .ms-glow,
.ms-reveal .ms-bloom,
.ms-reveal .ms-spark { opacity: 0; }
.ms-reveal .ms-sweep { opacity: 0; }

.ms-reveal .ms-glow {
  background: radial-gradient(55% 130% at 50% 45%, rgba(192,132,252,0.30), rgba(129,140,248,0.10) 48%, transparent 72%);
}
.ms-reveal .ms-bloom {
  background: radial-gradient(closest-side, rgba(245,243,255,0.9), rgba(196,132,252,0.5) 45%, transparent 78%);
  filter: blur(3px);
}
.ms-reveal .ms-sweep {
  background: radial-gradient(closest-side, rgba(255,255,255,0.95), rgba(196,132,252,0.55) 40%, transparent 75%);
  filter: blur(2px);
  mix-blend-mode: screen;
}

.ms-reveal.is-on .ms-intro { animation: ms-fade 0.8s ease-out 0.1s forwards; }
.ms-reveal.is-on .ms-glow  { animation: ms-fade 1.3s ease-out 0.15s forwards, ms-breathe 6s ease-in-out 1.6s infinite; }
.ms-reveal.is-on .ms-word  { animation: ms-rise 0.9s ease-out 0.3s forwards; }
.ms-reveal.is-on .ms-arc   { animation: ms-fade 1s ease-out 0.4s forwards; }
.ms-reveal.is-on .ms-bloom { animation: ms-bloom-in 0.9s ease-out 0.55s forwards, ms-breathe 5s ease-in-out 1.8s infinite; }
.ms-reveal.is-on .ms-sweep { animation: ms-sweep 1.5s cubic-bezier(.4,0,.2,1) 0.5s forwards; }
.ms-reveal.is-on .ms-tag   { animation: ms-fade 0.9s ease-out 1s forwards; }
.ms-reveal.is-on .ms-spark-1 { animation: ms-fade 0.8s ease-out 1s forwards, ms-twinkle 4.5s ease-in-out 1.8s infinite; }
.ms-reveal.is-on .ms-spark-2 { animation: ms-fade 0.8s ease-out 1.2s forwards, ms-twinkle 4.5s ease-in-out 2.3s infinite; }

@keyframes ms-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes ms-rise { from { opacity: 0; transform: translateY(7px); } to { opacity: 1; transform: translateY(0); } }
@keyframes ms-bloom-in { from { opacity: 0; transform: translate(-50%,-50%) scale(0.55); } to { opacity: 0.85; transform: translate(-50%,-50%) scale(1); } }
@keyframes ms-breathe { 0%, 100% { opacity: 0.72; } 50% { opacity: 1; } }
@keyframes ms-twinkle { 0%, 100% { opacity: 0.4; transform: scale(0.9); } 50% { opacity: 0.95; transform: scale(1.08); } }
@keyframes ms-sweep {
  0%   { opacity: 0; transform: translate(-360%, -50%); }
  15%  { opacity: 1; }
  85%  { opacity: 1; }
  100% { opacity: 0; transform: translate(260%, -50%); }
}

.ms-reveal.is-reduced .ms-intro,
.ms-reveal.is-reduced .ms-word,
.ms-reveal.is-reduced .ms-tag,
.ms-reveal.is-reduced .ms-arc,
.ms-reveal.is-reduced .ms-glow,
.ms-reveal.is-reduced .ms-bloom,
.ms-reveal.is-reduced .ms-spark { opacity: 1; animation: none; }
.ms-reveal.is-reduced .ms-bloom { transform: translate(-50%,-50%) scale(1); }
.ms-reveal.is-reduced .ms-sweep { opacity: 0; }
`;
