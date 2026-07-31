"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Zap, Play, BookOpen, Shuffle, Layers, ArrowRight, Clock, Loader2 } from "lucide-react";
import { useTestStore } from "@/lib/store/use-test-store";

interface AnalyticsData {
  total_questions_practiced: number;
  accuracy_percentage: number | null;
  average_score: number | null;
  tests_completed: number;
  current_streak_days: number;
  average_time_per_question_seconds: number | null;
  weakest_subject: string | null;
  strongest_subject: string | null;
  has_completed_attempts: boolean;
}

export default function DashboardPage() {
  const { examId, isSubmitted, timeRemaining, resetTest } = useTestStore();
  const hasActiveAttempt = !!(examId && !isSubmitted);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAnalytics() {
      try {
        const res = await fetch("/api/cbt/analytics");
        if (res.ok) {
          const data = await res.json();
          setAnalytics(data);
        }
      } catch (err) {
        console.error("Failed to fetch analytics:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchAnalytics();
  }, []);

  const hasData = analytics?.has_completed_attempts;

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans flex flex-col antialiased select-none">
      {/* Minimal Top Header */}
      <header className="border-b border-gray-200 bg-white sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2 font-bold text-lg tracking-tight text-gray-900">
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-white fill-white" />
            </div>
            <span>LastMile<span className="text-blue-600">Prep</span></span>
          </Link>

          <Link
            href="/test/create"
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-lg text-xs transition-colors flex items-center gap-1.5 shadow-xs"
          >
            <span>Start Test</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 flex-1 space-y-8">
        {/* Title */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Dashboard</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              {hasData ? "SSC CGL Candidate Attempt Telemetry & Performance" : "Take your first mock to generate performance analytics"}
            </p>
          </div>
        </div>

        {/* Active Attempt Banner */}
        {hasActiveAttempt && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-amber-900">In-Progress Exam Detected</h3>
                <p className="text-xs text-amber-700">{Math.floor(timeRemaining / 60)} minutes remaining in active session</p>
              </div>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Link
                href={`/test/${examId}`}
                className="flex-1 sm:flex-none px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-xs"
              >
                <Play className="w-3.5 h-3.5 fill-white" />
                <span>Continue Last Test</span>
              </Link>
              <button
                onClick={resetTest}
                className="px-3 py-2 rounded-lg border border-gray-200 text-gray-500 hover:text-gray-700 text-xs font-medium transition-colors"
              >
                Discard
              </button>
            </div>
          </div>
        )}

        {/* Dynamic Analytics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl space-y-1">
            <span className="text-xs text-gray-500 font-medium block">Unique Questions Practiced</span>
            <span className="text-2xl font-extrabold text-gray-900">
              {loading ? "..." : analytics?.total_questions_practiced || 0}
            </span>
          </div>

          <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl space-y-1">
            <span className="text-xs text-gray-500 font-medium block">Overall Accuracy</span>
            <span className="text-2xl font-extrabold text-emerald-600">
              {loading ? "..." : hasData && analytics?.accuracy_percentage !== null ? `${analytics.accuracy_percentage.toFixed(1)}%` : "—"}
            </span>
          </div>

          <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl space-y-1">
            <span className="text-xs text-gray-500 font-medium block">Average Score</span>
            <span className="text-2xl font-extrabold text-blue-600">
              {loading ? "..." : hasData && analytics?.average_score !== null ? analytics.average_score.toFixed(1) : "—"}
            </span>
            {hasData && <span className="text-[10px] text-gray-400 font-medium"> / 200 Max</span>}
          </div>

          <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl space-y-1">
            <span className="text-xs text-gray-500 font-medium block">Tests Completed</span>
            <span className="text-2xl font-extrabold text-gray-900">
              {loading ? "..." : analytics?.tests_completed || 0}
            </span>
          </div>

          <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl space-y-1">
            <span className="text-xs text-gray-500 font-medium block">Current Streak</span>
            <span className="text-2xl font-extrabold text-amber-600">
              {loading ? "..." : `${analytics?.current_streak_days || 0} Days`}
            </span>
          </div>

          <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl space-y-1">
            <span className="text-xs text-gray-500 font-medium block">Average Time / Question</span>
            <span className="text-2xl font-extrabold text-gray-900">
              {loading ? "..." : hasData && analytics?.average_time_per_question_seconds !== null ? `${analytics.average_time_per_question_seconds}s` : "—"}
            </span>
          </div>

          <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl space-y-1">
            <span className="text-xs text-gray-500 font-medium block">Weakest Subject</span>
            <span className="text-base font-bold text-red-600 truncate block">
              {loading ? "..." : hasData && analytics?.weakest_subject ? analytics.weakest_subject : "—"}
            </span>
          </div>

          <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl space-y-1">
            <span className="text-xs text-gray-500 font-medium block">Strongest Subject</span>
            <span className="text-base font-bold text-emerald-600 truncate block">
              {loading ? "..." : hasData && analytics?.strongest_subject ? analytics.strongest_subject : "—"}
            </span>
          </div>
        </div>

        {/* Three Action Mode Launcher Cards */}
        <div className="space-y-3">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Start Exam Session</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Card 1: Previous Year Paper */}
            <Link
              href="/test/create?mode=previous_year_paper"
              className="group bg-white border border-gray-200 hover:border-blue-600 p-5 rounded-xl transition-all flex flex-col justify-between space-y-4 shadow-xs hover:shadow-sm"
            >
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <BookOpen className="w-5 h-5" />
                </div>
                <span className="text-xs font-semibold text-gray-400">138 Official Papers</span>
              </div>

              <div>
                <h3 className="text-base font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                  Previous Year Paper
                </h3>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                  Real SSC CGL shift papers (2020–2024) with official TCS answer keys.
                </p>
              </div>

              <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 pt-1">
                <span>Select Paper</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>

            {/* Card 2: Topic Test */}
            <Link
              href="/test/create?mode=subject_test"
              className="group bg-white border border-gray-200 hover:border-blue-600 p-5 rounded-xl transition-all flex flex-col justify-between space-y-4 shadow-xs hover:shadow-sm"
            >
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Layers className="w-5 h-5" />
                </div>
                <span className="text-xs font-semibold text-gray-400">4 Subjects</span>
              </div>

              <div>
                <h3 className="text-base font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                  Topic Test
                </h3>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                  Target Reasoning, Quant, English, or General Awareness individually.
                </p>
              </div>

              <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 pt-1">
                <span>Select Subject</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>

            {/* Card 3: Random Mock */}
            <Link
              href="/test/create?mode=random_test"
              className="group bg-white border border-gray-200 hover:border-blue-600 p-5 rounded-xl transition-all flex flex-col justify-between space-y-4 shadow-xs hover:shadow-sm"
            >
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Shuffle className="w-5 h-5" />
                </div>
                <span className="text-xs font-semibold text-gray-400">100 Qs Mock</span>
              </div>

              <div>
                <h3 className="text-base font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                  Random Mock
                </h3>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                  Balanced 100 questions (25 per section) drawn randomly from question bank.
                </p>
              </div>

              <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 pt-1">
                <span>Launch Mock</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
