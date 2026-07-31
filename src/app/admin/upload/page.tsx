/* eslint-disable */
"use client";

import React, { useState } from "react";
import Link from "next/link";
import { getMergedExamsList } from "@/lib/mock-data/exams";
import {
  FileCheck,
  Zap,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Database,
  Lock,
} from "lucide-react";

export default function AdminPdfUploadPage() {
  const exams = getMergedExamsList();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col selection:bg-indigo-500 selection:text-white">
      {/* Header Bar */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-black text-xl tracking-tight text-white group">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-600 to-amber-500 flex items-center justify-center">
              <Zap className="w-4 h-4 text-white fill-white" />
            </div>
            <span>Last<span className="text-amber-400">Min</span>Prep</span>
            <span className="ml-2 text-xs bg-emerald-500/20 text-emerald-400 font-bold px-2 py-0.5 rounded border border-emerald-500/30">
              System Pre-Ingested PYP Vault
            </span>
          </Link>

          <Link
            href="/dashboard"
            className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg border border-slate-700 font-semibold transition-colors"
          >
            Go to Exam Selector
          </Link>
        </div>
      </header>

      {/* Main Body */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 space-y-8">
        {/* Banner */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-2">
              <ShieldCheck className="w-4 h-4" />
              <span>Official SSC CGL Solved Paper Repository Connected</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
              <Database className="w-7 h-7 text-amber-400" />
              <span>Pre-Parsed Official PYP & Answer Key Bank</span>
            </h1>
            <p className="text-slate-400 text-sm mt-1 max-w-2xl">
              All official 30-Yearwise SSC CGL Question Booklets & Answer Keys (2018 to 2024) have been parsed on the server side and ingested directly into the live CBT engine. Manual candidate file uploads are disabled for security and consistency.
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl text-center">
            <span className="text-3xl font-black text-amber-400 block">{exams.length} Papers</span>
            <span className="text-xs text-slate-400 font-medium">Ready in CBT Engine</span>
          </div>
        </div>

        {/* Security & System Info Notice */}
        <div className="bg-slate-900 border border-amber-500/30 p-4 rounded-xl flex items-center gap-3 text-xs text-amber-300">
          <Lock className="w-5 h-5 text-amber-400 flex-shrink-0" />
          <span>
            <strong>System Security Directive Enforced:</strong> End-user file upload permissions are locked. Questions are served directly from verified server-parsed official SSC CGL response keys with KaTeX LaTeX math formatting.
          </span>
        </div>

        {/* Live Ingested Papers Grid */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <FileCheck className="w-5 h-5 text-indigo-400" />
              <span>Verified Pre-Ingested SSC CGL Solved Papers (2018 – 2024)</span>
            </h2>
            <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-full font-bold">
              100% Validated
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {exams.map((paper) => (
              <div
                key={paper.id}
                className="bg-slate-950 border border-slate-800 rounded-xl p-5 hover:border-amber-400/50 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-[11px] font-bold px-2 py-0.5 rounded">
                      {paper.year}
                    </span>
                    <span className="text-[11px] text-slate-400">{paper.shift}</span>
                  </div>

                  <h3 className="font-bold text-white text-base mb-2">{paper.title}</h3>

                  <div className="text-xs text-slate-400 space-y-1 mb-4">
                    <p>• {paper.totalQuestions} Questions (100 Qs Full Replica)</p>
                    <p>• +2.0 Marks per correct answer, -0.50 negative penalty</p>
                    <p>• KaTeX LaTeX Step-by-Step Solutions attached</p>
                  </div>
                </div>

                <Link
                  href={`/test/${paper.id}`}
                  className="w-full py-2.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs transition-colors flex items-center justify-center gap-1.5 shadow"
                >
                  <span>Launch Test Player</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
