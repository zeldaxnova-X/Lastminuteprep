"use client";

import { useState } from "react";
import Link from "next/link";
import { Zap, RotateCcw, CheckCircle2, XCircle, ChevronRight, Filter, RefreshCw } from "lucide-react";
import { KaTeXRenderer } from "@/components/katex-renderer";

interface RevisionItem {
  id: string;
  question_number: number;
  question_text: string;
  user_answer: string;
  correct_answer: string;
  explanation: string;
  subject: string;
  paper_name: string;
}

export default function RevisionQueuePage() {
  const [items, setItems] = useState<RevisionItem[]>([
    {
      id: "rev-1",
      question_number: 14,
      question_text: "In a triangle $ABC$, the bisector of $\\angle A$ intersects $BC$ at $D$. If $AB = 12$ cm, $AC = 15$ cm, and $BD = 6$ cm, find $DC$.",
      user_answer: "B (8 cm)",
      correct_answer: "A (7.5 cm)",
      explanation: "By Angle Bisector Theorem: $\\frac{AB}{AC} = \\frac{BD}{DC} \\Rightarrow \\frac{12}{15} = \\frac{6}{DC} \\Rightarrow 12 \\cdot DC = 90 \\Rightarrow DC = 7.5$ cm.",
      subject: "Quantitative Aptitude",
      paper_name: "SSC CGL 2023 Shift 1",
    },
    {
      id: "rev-2",
      question_number: 32,
      question_text: "Four letter-clusters have been given, out of which three are alike in some manner and one is different. Select the odd one: **PK, GT, MN, IR, HS, XC**",
      user_answer: "C (HS)",
      correct_answer: "D (XC)",
      explanation: "All pairs except XC are reverse opposite letter pairs ($P\\leftrightarrow K, G\\leftrightarrow T, M\\leftrightarrow N, I\\leftrightarrow R, H\\leftrightarrow S$). X opposite is C is false ($X\\leftrightarrow C$ is correct, but let's check alphabetical position difference).",
      subject: "General Intelligence & Reasoning",
      paper_name: "SSC CGL 2023 Shift 2",
    },
  ]);

  const [filter, setFilter] = useState("ALL");

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2.5 font-black text-xl tracking-tight text-white">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-red-600 to-amber-500 flex items-center justify-center">
              <Zap className="w-4 h-4 text-white fill-white" />
            </div>
            <span>LastMile<span className="text-red-400">Prep</span></span>
          </Link>
          <Link href="/dashboard" className="text-xs text-slate-400 hover:text-white transition-colors font-semibold">
            ← Back to Dashboard
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 flex-1 space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <RotateCcw className="w-7 h-7 text-red-400" />
            <span>Wrong Answer Revision Queue</span>
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Systematic spaced-repetition queue of missed questions across your mock exam history.
          </p>
        </div>

        {/* Filter Bar */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 overflow-x-auto text-xs font-semibold">
            {["ALL", "Quantitative Aptitude", "General Intelligence & Reasoning", "General Awareness", "English Comprehension"].map((subj) => (
              <button
                key={subj}
                onClick={() => setFilter(subj)}
                className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
                  filter === subj
                    ? "bg-red-600 text-white font-bold"
                    : "bg-slate-950 border border-slate-800 text-slate-400 hover:text-white"
                }`}
              >
                {subj}
              </button>
            ))}
          </div>

          <span className="text-xs text-slate-400 flex-shrink-0">
            {items.length} Items Pending Revision
          </span>
        </div>

        {/* Revision Items */}
        <div className="space-y-6">
          {items.map((item) => (
            <div
              key={item.id}
              className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="bg-slate-950 border border-slate-800 text-red-400 font-bold px-2.5 py-1 rounded-md">
                    {item.subject}
                  </span>
                  <span className="text-slate-400">{item.paper_name}</span>
                </div>

                <span className="text-red-400 font-bold bg-red-500/10 border border-red-500/30 px-2.5 py-0.5 rounded-md">
                  Missed in Mock
                </span>
              </div>

              <div className="text-base text-slate-100 font-medium leading-relaxed bg-slate-950 border border-slate-800/80 rounded-xl p-4">
                <KaTeXRenderer content={item.question_text} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-semibold">
                <div className="bg-red-500/10 border border-red-500/30 p-3 rounded-xl flex items-center justify-between text-red-300">
                  <span>Your Previous Option:</span>
                  <span className="font-bold">{item.user_answer}</span>
                </div>

                <div className="bg-emerald-500/10 border border-emerald-500/30 p-3 rounded-xl flex items-center justify-between text-emerald-300">
                  <span>Correct Option:</span>
                  <span className="font-bold">{item.correct_answer}</span>
                </div>
              </div>

              <div className="bg-slate-950 border border-blue-500/30 rounded-2xl p-4 space-y-2 text-xs">
                <span className="font-bold text-blue-400 uppercase tracking-wider block text-[10px]">
                  Step-by-Step LaTeX Explanation
                </span>
                <div className="text-slate-300 leading-relaxed">
                  <KaTeXRenderer content={item.explanation} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
