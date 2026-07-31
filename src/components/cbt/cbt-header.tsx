"use client";

import React, { useEffect, useState } from "react";
import { useTestStore } from "@/lib/store/use-test-store";
import { Clock, Maximize2, Minimize2, Activity, Zap, User } from "lucide-react";

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
  let notVisitedCount = 0;

  Object.values(questionStatuses).forEach((st) => {
    if (st === "answered" || st === "answered_marked") answeredCount++;
    if (st === "marked" || st === "answered_marked") markedCount++;
    if (st === "not_visited") notVisitedCount++;
  });

  const remainingCount = Math.max(0, totalQuestions - answeredCount);
  const attemptedCount = Math.max(1, currentQuestionIndex + 1);
  const avgPaceSeconds = Math.round(elapsedSeconds / attemptedCount);

  return (
    <header className="bg-white border-b border-gray-300 px-4 py-2 flex items-center justify-between select-none">
      {/* Left: Logo & Paper Title */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 font-bold text-gray-900 text-sm">
          <div className="w-6 h-6 rounded bg-blue-600 flex items-center justify-center">
            <Zap className="w-3.5 h-3.5 text-white fill-white" />
          </div>
          <span>SSC CBT</span>
        </div>
        <div className="h-4 w-px bg-gray-300" />
        <h1 className="text-xs font-bold text-gray-800 truncate max-w-xs sm:max-w-md">{title}</h1>
      </div>

      {/* Right: Candidate, Metrics, Live Pace, Clock */}
      <div className="flex items-center gap-3">
        {/* Candidate Profile */}
        <div className="hidden lg:flex items-center gap-2 bg-gray-50 border border-gray-200 px-2.5 py-1 rounded text-xs">
          <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
            <User className="w-3 h-3" />
          </div>
          <span className="font-semibold text-gray-800">SSC Aspirant</span>
        </div>

        {/* Attempt Counters */}
        <div className="hidden md:flex items-center gap-2 text-xs bg-gray-50 border border-gray-200 px-3 py-1 rounded">
          <div>
            <span className="text-gray-400 text-[10px] uppercase block">Answered</span>
            <span className="font-bold text-emerald-600">{answeredCount}</span>
          </div>
          <div className="w-px h-4 bg-gray-200" />
          <div>
            <span className="text-gray-400 text-[10px] uppercase block">Marked</span>
            <span className="font-bold text-violet-600">{markedCount}</span>
          </div>
          <div className="w-px h-4 bg-gray-200" />
          <div>
            <span className="text-gray-400 text-[10px] uppercase block">Remaining</span>
            <span className="font-bold text-gray-700">{remainingCount}</span>
          </div>
        </div>

        {/* Live Average Pace */}
        <div className="hidden sm:flex items-center gap-1.5 text-xs bg-blue-50 border border-blue-200 text-blue-800 px-2.5 py-1 rounded font-medium">
          <Activity className="w-3.5 h-3.5 text-blue-600" />
          <span>Average Pace: <strong className="font-bold">{formatLivePace(avgPaceSeconds)}</strong> / Q</span>
        </div>

        {/* Fullscreen Toggle */}
        <button
          onClick={toggleFullscreen}
          className="p-1 rounded border border-gray-300 text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
          title="Toggle Fullscreen"
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>

        {/* Large Countdown Clock */}
        <div
          className={`flex items-center gap-1.5 px-3 py-1 rounded font-mono font-bold text-sm transition-colors ${
            isLowTime
              ? "bg-red-50 border border-red-300 text-red-600 animate-pulse"
              : "bg-gray-100 border border-gray-300 text-gray-900"
          }`}
        >
          <Clock className={`w-4 h-4 ${isLowTime ? "text-red-500" : "text-gray-500"}`} />
          <span>{formatTime(timeRemaining)}</span>
        </div>
      </div>
    </header>
  );
};
