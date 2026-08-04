"use client";

import React, { useEffect, useState } from "react";
import { useTestStore } from "@/lib/store/use-test-store";
import { Clock, Maximize2, Minimize2, Gauge } from "lucide-react";

interface CBTHeaderProps {
  title: string;
  totalQuestions: number;
}

export const CBTHeader: React.FC<CBTHeaderProps> = ({ title, totalQuestions }) => {
  const {
    timeRemaining,
    tickTimer,
    isSubmitted,
    currentQuestionIndex,
    questionStatuses,
    isFullscreen,
    toggleFullscreen,
  } = useTestStore();

  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

  useEffect(() => {
    if (isSubmitted) return;
    const interval = setInterval(() => {
      tickTimer();
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [tickTimer, isSubmitted]);

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) return `${hours}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const formatLivePace = (seconds: number) => {
    if (seconds <= 0) return "0s";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) return `${mins}m ${secs.toString().padStart(2, "0")}s`;
    return `${secs}s`;
  };

  const isLowTime = timeRemaining <= 300;

  let answeredCount = 0;
  let markedCount = 0;
  Object.values(questionStatuses).forEach((st) => {
    if (st === "answered" || st === "answered_marked") answeredCount++;
    if (st === "marked" || st === "answered_marked") markedCount++;
  });

  const remainingCount = Math.max(0, totalQuestions - answeredCount);
  const attemptedCount = Math.max(1, currentQuestionIndex + 1);
  const avgPaceSeconds = Math.round(elapsedSeconds / attemptedCount);

  return (
    <header className="z-30 flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white/90 px-3 py-2.5 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/90 sm:px-5">
      {/* Left: brand + paper title */}
      <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-sm font-bold text-white shadow-sm">
          L
        </div>
        <div className="hidden h-5 w-px bg-slate-200 dark:bg-slate-700 sm:block" />
        <h1 className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100 max-w-[150px] sm:max-w-xs md:max-w-md">
          {title}
        </h1>
      </div>

      {/* Right: metrics + pace + fullscreen + clock */}
      <div className="flex flex-shrink-0 items-center gap-2 sm:gap-2.5">
        <div className="hidden items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs dark:border-slate-800 dark:bg-slate-800/60 lg:flex">
          <Metric label="Answered" value={answeredCount} tone="emerald" />
          <span className="h-6 w-px bg-slate-200 dark:bg-slate-700" />
          <Metric label="Marked" value={markedCount} tone="violet" />
          <span className="h-6 w-px bg-slate-200 dark:bg-slate-700" />
          <Metric label="Left" value={remainingCount} tone="slate" />
        </div>

        <div className="hidden items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-600 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-300 md:flex">
          <Gauge className="h-3.5 w-3.5 text-indigo-500" />
          <span className="tabular-nums">{formatLivePace(avgPaceSeconds)}/Q</span>
        </div>

        <button
          onClick={toggleFullscreen}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-800 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          title="Toggle fullscreen"
          aria-label="Toggle fullscreen"
        >
          {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </button>

        <div
          className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 font-mono text-sm font-semibold tabular-nums transition-colors ${
            isLowTime
              ? "animate-pulse border-rose-300 bg-rose-50 text-rose-600 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-400"
              : "border-slate-200 bg-slate-50 text-slate-900 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-100"
          }`}
        >
          <Clock className={`h-4 w-4 ${isLowTime ? "text-rose-500" : "text-slate-400"}`} />
          <span>{formatTime(timeRemaining)}</span>
        </div>
      </div>
    </header>
  );
};

const toneMap: Record<string, string> = {
  emerald: "text-emerald-600 dark:text-emerald-400",
  violet: "text-violet-600 dark:text-violet-400",
  slate: "text-slate-700 dark:text-slate-200",
};

const Metric: React.FC<{ label: string; value: number; tone: string }> = ({ label, value, tone }) => (
  <div className="text-center">
    <span className="block text-[10px] uppercase tracking-wide text-slate-400">{label}</span>
    <span className={`block font-bold tabular-nums ${toneMap[tone]}`}>{value}</span>
  </div>
);
