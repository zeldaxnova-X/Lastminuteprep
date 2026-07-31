"use client";

import { useState } from "react";
import Link from "next/link";
import { Zap, BarChart2, TrendingUp, ShieldCheck, Award, Clock, Target, AlertTriangle, Sparkles } from "lucide-react";

export default function AnalyticsPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2.5 font-black text-xl tracking-tight text-white">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center">
              <Zap className="w-4 h-4 text-white fill-white" />
            </div>
            <span>LastMile<span className="text-blue-400">Prep</span></span>
          </Link>
          <Link href="/dashboard" className="text-xs text-slate-400 hover:text-white transition-colors font-semibold">
            ← Back to Dashboard
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex-1 space-y-8">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-bold uppercase tracking-wider mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Longitudinal Behavioral Profile</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
            Personal Exam DNA & Historical Analytics
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Tracks your solving speed, negative marking trajectory, subject accuracy trends, and strategy evolution over time.
          </p>
        </div>

        {/* DNA Summary Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-1">
            <span className="text-xs text-slate-400 font-semibold block">Strongest Subject</span>
            <span className="text-xl font-extrabold text-emerald-400">English Comprehension</span>
            <p className="text-[11px] text-slate-400">92.4% avg accuracy over last 5 mocks</p>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-1">
            <span className="text-xs text-slate-400 font-semibold block">Preferred Solving Speed</span>
            <span className="text-xl font-extrabold text-blue-400">38s / question</span>
            <p className="text-[11px] text-slate-400">Fastest in Reasoning (28s/q)</p>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-1">
            <span className="text-xs text-slate-400 font-semibold block">Negative Mark Trend</span>
            <span className="text-xl font-extrabold text-amber-400">-3.50 Marks / Exam</span>
            <p className="text-[11px] text-slate-400">Decreased by 28% this month</p>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-1">
            <span className="text-xs text-slate-400 font-semibold block">Decision Quality Avg</span>
            <span className="text-xl font-extrabold text-purple-400">84 / 100</span>
            <p className="text-[11px] text-slate-400">+12 pts gain since baseline</p>
          </div>
        </div>

        {/* Subject Accuracy Progress Bars */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-blue-400" />
            <span>Subject Accuracy Trends Across Mocks</span>
          </h2>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs font-bold text-slate-300 mb-1">
                <span>English Comprehension</span>
                <span className="text-emerald-400">92%</span>
              </div>
              <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: "92%" }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-bold text-slate-300 mb-1">
                <span>General Intelligence & Reasoning</span>
                <span className="text-blue-400">88%</span>
              </div>
              <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                <div className="h-full bg-blue-500 rounded-full" style={{ width: "88%" }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-bold text-slate-300 mb-1">
                <span>Quantitative Aptitude</span>
                <span className="text-amber-400">74%</span>
              </div>
              <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                <div className="h-full bg-amber-500 rounded-full" style={{ width: "74%" }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-bold text-slate-300 mb-1">
                <span>General Awareness</span>
                <span className="text-red-400">62%</span>
              </div>
              <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                <div className="h-full bg-red-500 rounded-full" style={{ width: "62%" }} />
              </div>
            </div>
          </div>
        </div>

        {/* Master Strategy Trajectory */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-4 shadow-xl">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            <span>Virtual Mentor Strategy Milestones</span>
          </h2>

          <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex items-start gap-3">
              <span className="font-bold text-emerald-400 text-sm">✓</span>
              <div>
                <strong className="text-white block">Quant Accuracy Improvement</strong>
                Your Quantitative Aptitude accuracy improved by +14% over your last five mock tests.
              </div>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex items-start gap-3">
              <span className="font-bold text-blue-400 text-sm">✓</span>
              <div>
                <strong className="text-white block">Reasoning Pacing Optimization</strong>
                You are spending 22% less time per reasoning question than last month (avg 28s vs 36s).
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
