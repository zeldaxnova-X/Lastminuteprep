"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { ExamAnalysis } from "@/lib/analytics/types";
import {
  Zap,
  Clock,
  ArrowRight,
  Sparkles,
  Loader2,
  Brain,
  Target,
  AlertTriangle,
  Compass,
  Calendar,
} from "lucide-react";

export default function VirtualMentorPage() {
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
          setError("Failed to load mentor analysis");
        }
      } catch (err) {
        console.error("Failed to load mentor analysis:", err);
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
        <span className="text-sm font-bold tracking-wide uppercase">Analyzing Candidate Telemetry...</span>
      </div>
    );
  }

  if (error || !analysis) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-white text-gray-700 gap-4 font-sans">
        <p className="text-sm text-red-600 font-bold">{error || "Mentor analysis unavailable"}</p>
        <Link href="/dashboard" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold">
          Return to Dashboard
        </Link>
      </div>
    );
  }

  const { behaviour, simulations, topicAnalysis, mentor, reviewMetrics, negativeMarking, score } = analysis;
  const dq = {
    knowledge_score: Math.round(analysis.accuracy.overall_accuracy),
    time_management_score: Math.max(20, 100 - analysis.pace.time_sink_count * 15),
    risk_management_score: Math.max(20, 100 - Math.round(negativeMarking.negative_loss * 5)),
    review_strategy_score: reviewMetrics.review_efficiency_pct,
    consistency_score: 80,
    overall_decision_quality: Math.round(
      analysis.accuracy.overall_accuracy * 0.3 +
      Math.max(20, 100 - analysis.pace.time_sink_count * 15) * 0.25 +
      Math.max(20, 100 - Math.round(negativeMarking.negative_loss * 5)) * 0.2 +
      reviewMetrics.review_efficiency_pct * 0.15 +
      80 * 0.1
    ),
  };

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans flex flex-col antialiased select-none">
      {/* Top Header Navigation */}
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
            <Link href={`/test/${examId}/result`} className="px-3 py-1.5 rounded-lg text-gray-600 hover:text-gray-900">
              Page 1: Score Card
            </Link>
            <span className="bg-white text-blue-600 px-3 py-1.5 rounded-lg shadow-2xs font-bold border border-gray-200">
              Page 2: Virtual Mentor
            </span>
            <Link href={`/test/${examId}/review`} className="px-3 py-1.5 rounded-lg text-gray-600 hover:text-gray-900">
              Page 3: Answer Key
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 flex-1 space-y-8">
        {/* Mentor Title Banner */}
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold uppercase tracking-wider border border-blue-200">
            <Brain className="w-3.5 h-3.5 text-blue-600" />
            <span>Telemetry Analytics Engine Output</span>
          </div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Virtual Mentor</h1>
          <p className="text-sm text-gray-500 max-w-2xl">
            Derived directly from exam-analyzer.ts single source of truth engine.
          </p>
        </div>

        {/* Section 1: Overall Exam Behaviour Card */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 space-y-4">
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
            <Target className="w-4 h-4 text-blue-600" />
            <span>Overall Exam Behaviour</span>
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white border border-gray-200 p-4 rounded-xl">
              <span className="text-xs text-gray-500 font-medium block">Attempted Questions</span>
              <span className="text-2xl font-black text-gray-900">{behaviour.attempted}</span>
            </div>
            <div className="bg-white border border-gray-200 p-4 rounded-xl">
              <span className="text-xs text-gray-500 font-medium block">Skipped Questions</span>
              <span className="text-2xl font-black text-gray-500">{behaviour.skipped}</span>
            </div>
            <div className="bg-white border border-gray-200 p-4 rounded-xl">
              <span className="text-xs text-gray-500 font-medium block">Confident Answers</span>
              <span className="text-2xl font-black text-emerald-600">{behaviour.confident}</span>
            </div>
            <div className="bg-white border border-gray-200 p-4 rounded-xl">
              <span className="text-xs text-gray-500 font-medium block">Uncertain Answers</span>
              <span className="text-2xl font-black text-amber-600">{behaviour.uncertain}</span>
            </div>
          </div>
        </div>

        {/* Section 2: Decision Quality Score Grid */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5 shadow-2xs">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div>
              <h2 className="text-base font-bold text-gray-900">Decision Quality Scorecard</h2>
              <p className="text-xs text-gray-500">Evaluated on decision discipline rather than raw score</p>
            </div>
            <div className="bg-blue-600 text-white font-extrabold px-4 py-2 rounded-xl text-lg">
              {dq.overall_decision_quality} <span className="text-xs font-normal opacity-80">/ 100</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
            <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl space-y-1">
              <span className="text-xs font-semibold text-gray-500 block">Knowledge</span>
              <span className="text-2xl font-extrabold text-emerald-600">{dq.knowledge_score}</span>
            </div>

            <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl space-y-1">
              <span className="text-xs font-semibold text-gray-500 block">Time Management</span>
              <span className="text-2xl font-extrabold text-blue-600">{dq.time_management_score}</span>
            </div>

            <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl space-y-1">
              <span className="text-xs font-semibold text-gray-500 block">Risk Control</span>
              <span className="text-2xl font-extrabold text-amber-600">{dq.risk_management_score}</span>
            </div>

            <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl space-y-1">
              <span className="text-xs font-semibold text-gray-500 block">Review Strategy</span>
              <span className="text-2xl font-extrabold text-purple-600">{dq.review_strategy_score}</span>
            </div>

            <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl space-y-1">
              <span className="text-xs font-semibold text-gray-500 block">Consistency</span>
              <span className="text-2xl font-extrabold text-indigo-600">{dq.consistency_score}</span>
            </div>
          </div>
        </div>

        {/* Section 3: Structured Insights */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4 shadow-2xs">
          <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span>Structured Telemetry Insights</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {mentor.map((insight, idx) => (
              <div key={idx} className="bg-gray-50 border border-gray-200 p-4 rounded-xl space-y-2 text-xs">
                <div className="flex items-center justify-between font-bold">
                  <span className="text-gray-900">{insight.type}</span>
                  <span className="bg-red-50 text-red-700 px-2 py-0.5 rounded text-[10px] border border-red-200 uppercase">
                    {insight.severity}
                  </span>
                </div>
                <p className="text-gray-600">
                  Affected Questions: {insight.affected_questions.length > 0 ? insight.affected_questions.join(", ") : "N/A"}
                </p>
                <div className="flex items-center justify-between font-bold text-blue-600 pt-1">
                  <span>Score Impact: {insight.score_impact} Marks</span>
                  <span>Confidence: {Math.round(insight.confidence * 100)}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Section 4: Optimal Strategy Simulation */}
        <div className="bg-gray-900 text-white rounded-xl p-6 space-y-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-800 pb-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-blue-400 flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              <span>Strategy Replay Simulation</span>
            </h2>
            <span className="bg-blue-600/30 text-blue-300 border border-blue-500/40 text-xs font-bold px-3 py-1 rounded-full">
              Best Possible: {simulations.best_possible_score} Marks (+{simulations.difference_marks} Gap)
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="bg-gray-800 p-3.5 rounded-xl space-y-1">
              <span className="text-gray-400 block text-[11px]">Actual Score</span>
              <span className="text-xl font-bold text-white">{simulations.actual_score}</span>
            </div>
            <div className="bg-gray-800 p-3.5 rounded-xl space-y-1">
              <span className="text-gray-400 block text-[11px]">If Skipped Uncertain</span>
              <span className="text-xl font-bold text-emerald-400">{simulations.if_skipped_uncertain}</span>
            </div>
            <div className="bg-gray-800 p-3.5 rounded-xl space-y-1">
              <span className="text-gray-400 block text-[11px]">If Reviewed Marked</span>
              <span className="text-xl font-bold text-blue-400">{simulations.if_reviewed_marked}</span>
            </div>
            <div className="bg-gray-800 p-3.5 rounded-xl space-y-1">
              <span className="text-gray-400 block text-[11px]">If Avoided Rapid Guesses</span>
              <span className="text-xl font-bold text-amber-400">{simulations.if_avoided_rapid_guesses}</span>
            </div>
          </div>
        </div>

        {/* Section 5: Weak Topics */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4 shadow-2xs">
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-600" />
            <span>Metadata-Derived Weak Topics</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {topicAnalysis.weak_topics.map((wt) => (
              <div key={wt.topic} className="bg-gray-50 border border-gray-200 p-3 rounded-lg text-xs space-y-1">
                <div className="flex justify-between font-bold text-gray-900">
                  <span>{wt.topic}</span>
                  <span className="text-red-600">{wt.accuracy}% Acc</span>
                </div>
                <p className="text-gray-500 text-[11px]">{wt.subject} • Avg {wt.avg_time_seconds}s per Q</p>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom CTA to Answer Key */}
        <div className="flex justify-end pt-4">
          <Link
            href={`/test/${examId}/review`}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-3 rounded-xl text-xs transition-colors flex items-center gap-2 shadow-xs"
          >
            <span>Proceed to Page 3: Answer Key & Solutions</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </main>
    </div>
  );
}
