"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { ExamAnalysis } from "@/lib/analytics/types";
import { Zap, ArrowRight, Loader2, Brain } from "lucide-react";

export default function ExamResultPage() {
  const params = useParams();
  const examId = (params?.examId as string) || "";

  const [analysis, setAnalysis] = useState<ExamAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAnalysis() {
      if (!examId) return;
      setLoading(true);
      try {
        const res = await fetch(`/api/cbt/analysis/${examId}`);
        if (res.ok) {
          const data: ExamAnalysis = await res.json();
          setAnalysis(data);
        } else {
          setError("Failed to load attempt analysis");
        }
      } catch (err) {
        console.error("Failed to load analysis:", err);
        setError("Network error loading analysis");
      } finally {
        setLoading(false);
      }
    }

    fetchAnalysis();
  }, [examId]);

  if (loading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-white text-gray-700 gap-3 font-sans">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <span className="text-sm font-bold tracking-wide uppercase">Generating Single Source of Truth Analytics...</span>
      </div>
    );
  }

  if (error || !analysis) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-white text-gray-700 gap-4 font-sans">
        <p className="text-sm text-red-600 font-bold">{error || "Analysis unavailable"}</p>
        <Link href="/dashboard" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold">
          Return to Dashboard
        </Link>
      </div>
    );
  }

  const { score, marks, accuracy, pace, sectionPerformance } = analysis;

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans flex flex-col antialiased select-none">
      {/* Top Header */}
      <header className="border-b border-gray-200 bg-white sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2 font-bold text-lg tracking-tight text-gray-900">
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-white fill-white" />
            </div>
            <span>LastMile<span className="text-blue-600">Prep</span></span>
          </Link>

          {/* Three Post-Exam Flow Breadcrumb Tabs */}
          <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl border border-gray-200 text-xs font-semibold">
            <span className="bg-white text-blue-600 px-3 py-1.5 rounded-lg shadow-2xs font-bold border border-gray-200">
              Page 1: Score Card
            </span>
            <Link href={`/test/${examId}/mentor`} className="px-3 py-1.5 rounded-lg text-gray-600 hover:text-gray-900">
              Page 2: Virtual Mentor
            </Link>
            <Link href={`/test/${examId}/review`} className="px-3 py-1.5 rounded-lg text-gray-600 hover:text-gray-900">
              Page 3: Answer Key
            </Link>
          </div>
        </div>
      </header>

      {/* Main Score Card Container (Apple Style, Minimal, Spacious) */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10 flex-1 space-y-10">
        {/* Title */}
        <div className="text-center space-y-1">
          <span className="text-xs font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
            Official Diagnostic Score Card
          </span>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight pt-1">SSC CGL Examination Result</h1>
          <p className="text-xs text-gray-500">Single Source of Truth Telemetry Engine Output</p>
        </div>

        {/* Large Hero Card: Your Score */}
        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-8 text-center space-y-4 shadow-2xs">
          <span className="text-xs font-bold uppercase tracking-wider text-gray-500 block">Your Score</span>
          <div className="flex items-baseline justify-center gap-2">
            <span className="text-6xl font-black text-gray-900 tracking-tight">{score.total_score.toFixed(0)}</span>
            <span className="text-2xl font-bold text-gray-400">/ {score.max_score}</span>
          </div>

          <div className="flex items-center justify-center gap-3 pt-2">
            <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-3 py-1 rounded-full border border-emerald-300">
              {score.qualification_status}
            </span>
            <span className="bg-blue-100 text-blue-800 text-xs font-bold px-3 py-1 rounded-full border border-blue-300">
              {score.percentile_rank}
            </span>
          </div>
        </div>

        {/* Four Large Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white border border-gray-200 p-5 rounded-2xl space-y-1 text-center shadow-2xs">
            <span className="text-xs font-semibold text-gray-500 block">Correct</span>
            <span className="text-3xl font-extrabold text-emerald-600">{accuracy.correct_count}</span>
          </div>

          <div className="bg-white border border-gray-200 p-5 rounded-2xl space-y-1 text-center shadow-2xs">
            <span className="text-xs font-semibold text-gray-500 block">Incorrect</span>
            <span className="text-3xl font-extrabold text-red-600">{accuracy.incorrect_count}</span>
          </div>

          <div className="bg-white border border-gray-200 p-5 rounded-2xl space-y-1 text-center shadow-2xs">
            <span className="text-xs font-semibold text-gray-500 block">Skipped</span>
            <span className="text-3xl font-extrabold text-gray-400">{accuracy.skipped_count}</span>
          </div>

          <div className="bg-white border border-gray-200 p-5 rounded-2xl space-y-1 text-center shadow-2xs">
            <span className="text-xs font-semibold text-gray-500 block">Accuracy %</span>
            <span className="text-3xl font-extrabold text-blue-600">{accuracy.overall_accuracy.toFixed(1)}%</span>
          </div>
        </div>

        {/* Marks & Time Breakdown Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Marks Breakdown */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-3 shadow-2xs">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Marks Breakdown</h3>
            <div className="space-y-2 text-xs divide-y divide-gray-100">
              <div className="flex justify-between py-1.5">
                <span className="text-gray-600 font-medium">+ Correct Marks</span>
                <span className="font-bold text-emerald-600">+{marks.positive_marks.toFixed(1)}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-gray-600 font-medium">− Negative Marks</span>
                <span className="font-bold text-red-600">−{marks.negative_marks.toFixed(1)}</span>
              </div>
              <div className="flex justify-between py-1.5 pt-2 text-sm">
                <span className="font-bold text-gray-900">Final Score</span>
                <span className="font-extrabold text-blue-600">{marks.net_marks.toFixed(1)} / {marks.max_marks}</span>
              </div>
            </div>
          </div>

          {/* Time Breakdown */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-3 shadow-2xs">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Exam Time</h3>
            <div className="space-y-2 text-xs divide-y divide-gray-100">
              <div className="flex justify-between py-1.5">
                <span className="text-gray-600 font-medium">Time Used</span>
                <span className="font-bold text-gray-900">
                  {Math.floor(pace.time_used_seconds / 60)}m {pace.time_used_seconds % 60}s
                </span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-gray-600 font-medium">Time Remaining</span>
                <span className="font-bold text-gray-900">
                  {Math.floor(pace.time_remaining_seconds / 60)}m {pace.time_remaining_seconds % 60}s
                </span>
              </div>
              <div className="flex justify-between py-1.5 pt-2 text-sm">
                <span className="font-bold text-gray-900">Average Time / Question</span>
                <span className="font-extrabold text-blue-600">{pace.avg_pace_per_question_seconds}s</span>
              </div>
            </div>
          </div>
        </div>

        {/* Section Performance with Horizontal Progress Bars */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-6 shadow-2xs">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Section Performance</h3>

          <div className="space-y-4">
            {sectionPerformance.map((sec) => (
              <div key={sec.subject} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-gray-900">{sec.subject}</span>
                  <div className="flex items-center gap-3 text-gray-500">
                    <span>Score: <strong className="text-blue-600">{sec.net_score.toFixed(1)}</strong></span>
                    <span>Avg Pace: <strong className="text-gray-900">{sec.avg_time_per_question_seconds}s</strong></span>
                    <span className="font-bold text-emerald-600">{sec.accuracy}%</span>
                  </div>
                </div>

                {/* Horizontal Bar */}
                <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden flex">
                  <div
                    className="bg-blue-600 h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.max(5, sec.accuracy)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Call to Action Banner to Page 2 */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl p-8 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-sm">
          <div className="space-y-1 text-center sm:text-left">
            <div className="inline-flex items-center gap-1.5 bg-white/20 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
              <Brain className="w-3.5 h-3.5" />
              <span>Next Step in Post-Exam Flow</span>
            </div>
            <h2 className="text-2xl font-black tracking-tight">Open Virtual Mentor Analysis</h2>
            <p className="text-xs text-blue-100 leading-relaxed max-w-xl">
              Discover your Decision Quality score, score leaks, 7-day study plan, and strategy simulation powered by telemetry.
            </p>
          </div>

          <Link
            href={`/test/${examId}/mentor`}
            className="bg-white text-blue-600 hover:bg-blue-50 font-bold px-6 py-3.5 rounded-xl text-xs transition-colors shadow-sm flex items-center gap-2 flex-shrink-0"
          >
            <span>Proceed to Virtual Mentor (Page 2)</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </main>
    </div>
  );
}
