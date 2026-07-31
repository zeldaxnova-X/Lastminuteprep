"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useTestStore } from "@/lib/store/use-test-store";
import {
  Zap,
  BookOpen,
  Shuffle,
  Target,
  ArrowRight,
  History,
  Bookmark,
  Award,
  Clock,
  RotateCcw,
} from "lucide-react";

interface AnalyticsData {
  unique_questions_practiced: number;
  overall_accuracy: number;
  avg_score: number;
  tests_completed: number;
  current_streak: number;
  avg_time_per_question: number;
  weakest_subject: string | null;
  strongest_subject: string | null;
  has_completed_attempts: boolean;
}

export default function DashboardPage() {
  const { examId, isSubmitted, resetTest } = useTestStore();
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

  const handleDiscardAttempt = () => {
    if (confirm("Are you sure you want to discard your current active test? Progress will be lost.")) {
      resetTest();
    }
  };

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans antialiased selection:bg-blue-600 selection:text-white flex flex-col">
      {/* Top Bar */}
      <header className="border-b border-gray-200 bg-white sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2">
          <Link href="/dashboard" className="flex items-center gap-2 font-bold text-base sm:text-lg tracking-tight text-gray-900">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
              <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white fill-white" />
            </div>
            <span className="truncate">LastMile<span className="text-blue-600">Prep</span></span>
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/revision"
              className="text-xs font-semibold px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5 text-blue-600" />
              <span className="hidden sm:inline">Revision</span>
            </Link>

            <Link
              href="/bookmarks"
              className="text-xs font-semibold px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors flex items-center gap-1.5"
            >
              <Bookmark className="w-3.5 h-3.5 text-amber-500" />
              <span className="hidden sm:inline">Bookmarks</span>
            </Link>

            <Link
              href="/test/create"
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-3 sm:px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5 shadow-2xs min-h-[44px]"
            >
              <span>Start Test</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10 flex-1 space-y-6 sm:space-y-8 w-full">
        {/* Active Attempt Notification */}
        {hasActiveAttempt && (
          <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-2xs">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                <h3 className="font-bold text-sm sm:text-base">Active Test In Progress</h3>
              </div>
              <p className="text-xs text-amber-800">You have an ongoing exam session saved in memory.</p>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={handleDiscardAttempt}
                className="flex-1 sm:flex-none text-xs text-amber-700 hover:text-amber-950 font-semibold px-3 py-2 border border-amber-300 rounded-lg hover:bg-amber-100 transition-colors min-h-[44px]"
              >
                Discard
              </button>
              <Link
                href={`/test/${examId}`}
                className="flex-1 sm:flex-none text-xs bg-amber-600 hover:bg-amber-700 text-white font-bold px-4 py-2 rounded-lg transition-colors text-center shadow-2xs min-h-[44px] flex items-center justify-center"
              >
                Resume Test
              </Link>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">Dashboard</h1>
          <p className="text-xs sm:text-sm text-gray-500">
            {analytics?.has_completed_attempts
              ? "Performance telemetry derived from your completed CBT mocks"
              : "Take your first mock to generate performance analytics"}
          </p>
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white border border-gray-200 p-4 sm:p-5 rounded-xl space-y-1 shadow-2xs">
            <span className="text-xs font-semibold text-gray-500 block truncate">Unique Questions Practiced</span>
            <span className="text-2xl sm:text-3xl font-extrabold text-gray-900">
              {loading ? "..." : analytics?.unique_questions_practiced || 0}
            </span>
          </div>

          <div className="bg-white border border-gray-200 p-4 sm:p-5 rounded-xl space-y-1 shadow-2xs">
            <span className="text-xs font-semibold text-gray-500 block truncate">Overall Accuracy</span>
            <span className="text-2xl sm:text-3xl font-extrabold text-emerald-600">
              {loading ? "..." : analytics?.has_completed_attempts ? `${analytics.overall_accuracy.toFixed(1)}%` : "--"}
            </span>
          </div>

          <div className="bg-white border border-gray-200 p-4 sm:p-5 rounded-xl space-y-1 shadow-2xs">
            <span className="text-xs font-semibold text-gray-500 block truncate">Average Score</span>
            <span className="text-2xl sm:text-3xl font-extrabold text-blue-600">
              {loading ? "..." : analytics?.has_completed_attempts ? `${analytics.avg_score.toFixed(1)} / 200` : "--"}
            </span>
          </div>

          <div className="bg-white border border-gray-200 p-4 sm:p-5 rounded-xl space-y-1 shadow-2xs">
            <span className="text-xs font-semibold text-gray-500 block truncate">Tests Completed</span>
            <span className="text-2xl sm:text-3xl font-extrabold text-gray-900">
              {loading ? "..." : analytics?.tests_completed || 0}
            </span>
          </div>

          <div className="bg-white border border-gray-200 p-4 sm:p-5 rounded-xl space-y-1 shadow-2xs">
            <span className="text-xs font-semibold text-gray-500 block truncate">Current Streak</span>
            <span className="text-2xl sm:text-3xl font-extrabold text-amber-600">
              {loading ? "..." : `${analytics?.current_streak || 0} Days`}
            </span>
          </div>

          <div className="bg-white border border-gray-200 p-4 sm:p-5 rounded-xl space-y-1 shadow-2xs">
            <span className="text-xs font-semibold text-gray-500 block truncate">Average Time / Question</span>
            <span className="text-2xl sm:text-3xl font-extrabold text-gray-900">
              {loading ? "..." : analytics?.has_completed_attempts ? `${analytics.avg_time_per_question}s` : "--"}
            </span>
          </div>

          <div className="bg-white border border-gray-200 p-4 sm:p-5 rounded-xl space-y-1 shadow-2xs">
            <span className="text-xs font-semibold text-gray-500 block truncate">Weakest Subject</span>
            <span className="text-sm sm:text-base font-bold text-red-600 truncate block">
              {loading ? "..." : analytics?.weakest_subject || "--"}
            </span>
          </div>

          <div className="bg-white border border-gray-200 p-4 sm:p-5 rounded-xl space-y-1 shadow-2xs">
            <span className="text-xs font-semibold text-gray-500 block truncate">Strongest Subject</span>
            <span className="text-sm sm:text-base font-bold text-emerald-600 truncate block">
              {loading ? "..." : analytics?.strongest_subject || "--"}
            </span>
          </div>
        </div>

        {/* Start Exam Session Cards */}
        <div className="space-y-3 pt-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400">Start Exam Session</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Previous Year Papers */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 sm:p-6 space-y-4 shadow-2xs hover:border-gray-300 transition-all flex flex-col justify-between">
              <div className="space-y-2">
                <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <BookOpen className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-base text-gray-900">Previous Year Paper</h3>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Real SSC CGL shift papers (2020–2024) with official TCS answer keys.
                </p>
              </div>

              <Link
                href="/test/create?mode=pyp"
                className="w-full text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center justify-between pt-2 border-t border-gray-100 min-h-[44px]"
              >
                <span>Select Paper</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* Topic Test */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 sm:p-6 space-y-4 shadow-2xs hover:border-gray-300 transition-all flex flex-col justify-between">
              <div className="space-y-2">
                <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Target className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-base text-gray-900">Topic Test</h3>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Target Reasoning, Quant, English, or General Awareness individually.
                </p>
              </div>

              <Link
                href="/test/create?mode=subject"
                className="w-full text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center justify-between pt-2 border-t border-gray-100 min-h-[44px]"
              >
                <span>Select Subject</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* Random Mock */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 sm:p-6 space-y-4 shadow-2xs hover:border-gray-300 transition-all flex flex-col justify-between">
              <div className="space-y-2">
                <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Shuffle className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-base text-gray-900">Random Mock</h3>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Balanced 100 questions (25 per section) drawn randomly from question bank.
                </p>
              </div>

              <Link
                href="/test/create?mode=random"
                className="w-full text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center justify-between pt-2 border-t border-gray-100 min-h-[44px]"
              >
                <span>Launch Mock</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
