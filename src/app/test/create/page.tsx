"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Zap,
  BookOpen,
  Layers,
  Shuffle,
  ArrowRight,
  Loader2,
} from "lucide-react";
import type { ExamType, Subject, PaperType } from "@/types/database.types";
import { formatPaperDisplayName } from "@/lib/paper-formatter";

interface PaperItem {
  paper_id: string;
  paper_name_canonical: string;
  year: number;
  shift: string | null;
  tier: string | null;
  paper_type: PaperType;
  validated_questions: number;
}

interface CoverageData {
  overall: { total: number; done: number; remaining: number };
  by_subject: { subject: Subject; total: number; done: number; remaining: number }[];
}

function TestCreationForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const modeParam = searchParams.get("mode");
  
  const initialMode: ExamType = 
    modeParam === "subject_test" ? "subject_test" :
    modeParam === "random_test" ? "random_test" : "previous_year_paper";

  const [examType, setExamType] = useState<ExamType>(initialMode);
  const [papersList, setPapersList] = useState<PaperItem[]>([]);
  const [loadingPapers, setLoadingPapers] = useState(false);

  const [selectedPaperId, setSelectedPaperId] = useState<string>("");
  // A MarksenseAI drill deep-links here with ?subject=<full name>; honour it.
  const SUBJECTS: Subject[] = [
    "General Intelligence & Reasoning",
    "General Awareness",
    "Quantitative Aptitude",
    "English Comprehension",
  ];
  const subjectParam = searchParams.get("subject");
  const initialSubject: Subject =
    subjectParam && (SUBJECTS as string[]).includes(subjectParam)
      ? (subjectParam as Subject)
      : "Quantitative Aptitude";
  const [selectedSubject, setSelectedSubject] = useState<Subject>(initialSubject);
  const [questionCount, setQuestionCount] = useState<number>(100);

  // Per-user question-bank coverage (done vs remaining unique questions).
  const [coverage, setCoverage] = useState<CoverageData | null>(null);
  useEffect(() => {
    let alive = true;
    fetch("/api/cbt/analytics/coverage")
      .then((r) => (r.ok ? r.json() : null))
      .then((c) => alive && c?.overall && setCoverage(c))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  const remainingBySubject = (subject: Subject): number | null =>
    coverage?.by_subject.find((s) => s.subject === subject)?.remaining ?? null;

  // Plan gate: /test/create only offers real (non-sample) modes, so a FREE user
  // has nothing launchable here. Refuse it and point them to upgrade, the
  // server also 403s /start, so this is UX, not the enforcement boundary.
  const [plan, setPlan] = useState<"free" | "pro" | "mentor" | null>(null);
  useEffect(() => {
    let alive = true;
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((v) => alive && setPlan((v?.plan as "free" | "pro" | "mentor") ?? "free"))
      .catch(() => alive && setPlan("free"));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    async function fetchPapers() {
      setLoadingPapers(true);
      try {
        const res = await fetch("/api/cbt/papers");
        const json = await res.json();
        if (json.papers) {
          setPapersList(json.papers);
          if (json.papers.length > 0 && !selectedPaperId) {
            setSelectedPaperId(json.papers[0].paper_id);
          }
        }
      } catch (err) {
        console.error("Error fetching papers", err);
      } finally {
        setLoadingPapers(false);
      }
    }
    fetchPapers();
  }, []);

  const handleProceed = () => {
    const params = new URLSearchParams();
    params.set("exam_type", examType);
    if (examType === "previous_year_paper" && selectedPaperId) {
      params.set("paper_id", selectedPaperId);
      const paper = papersList.find((p) => p.paper_id === selectedPaperId);
      if (paper) {
        params.set("title", formatPaperDisplayName(paper));
      }
    }
    if (examType === "subject_test") {
      params.set("subject", selectedSubject);
      params.set("questions", questionCount.toString());
      params.set("time", Math.round(questionCount * 0.6).toString());
    } else {
      params.set("questions", "100");
      params.set("time", "60");
    }
    
    router.push(`/test/instructions?${params.toString()}`);
  };

  if (plan === null) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400 gap-2">
        <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
        <span className="text-xs">Loading…</span>
      </div>
    );
  }

  if (plan === "free") {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-xs">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50">
          <Zap className="h-6 w-6 text-blue-600" />
        </div>
        <h1 className="text-xl font-extrabold tracking-tight text-gray-900">
          Full tests are a Pro feature
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-gray-500">
          Your free plan includes the one-time sample. Upgrade to Pro to unlock previous-year
          papers, topic tests, and unlimited mocks from the full question bank.
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Link
            href="/dashboard#upgrade"
            className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
          >
            See upgrade options
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <Link
            href="/sample"
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-gray-200 px-5 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:border-gray-300"
          >
            Take the free sample
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 tracking-tight">Choose Your Test Mode</h1>
        <p className="text-xs text-gray-500 mt-1">Select paper or topic configuration to launch CBT test engine</p>
      </div>

      {/* Personal coverage: unique questions done vs remaining. Each test serves
          questions you haven't seen yet, so this ticks down as you practise. */}
      {coverage && coverage.overall.total > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-xs">
          <div className="flex items-baseline justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Your question bank progress
            </span>
            <span className="text-xs font-medium text-gray-500">
              <span className="font-bold text-gray-900">{coverage.overall.done.toLocaleString()}</span> done ·{" "}
              <span className="font-bold text-blue-600">{coverage.overall.remaining.toLocaleString()}</span> left
            </span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-blue-600 transition-all"
              style={{
                width: `${Math.min(100, Math.round((coverage.overall.done / coverage.overall.total) * 100))}%`,
              }}
            />
          </div>
          <p className="mt-1.5 text-[11px] text-gray-400">
            {coverage.overall.remaining === 0
              ? "You've practised every unique question, new tests now revisit past ones."
              : `${coverage.overall.done.toLocaleString()} of ${coverage.overall.total.toLocaleString()} unique questions practised. Every test pulls fresh ones.`}
          </p>
        </div>
      )}

      {/* 3 Core Modes */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <button
          onClick={() => setExamType("previous_year_paper")}
          className={`p-4 rounded-xl border text-left transition-all min-h-[72px] ${
            examType === "previous_year_paper"
              ? "bg-blue-50 border-blue-500 shadow-xs"
              : "bg-white border-gray-200 hover:border-gray-300"
          }`}
        >
          <BookOpen className={`w-5 h-5 mb-2 ${examType === "previous_year_paper" ? "text-blue-600" : "text-gray-400"}`} />
          <div className="text-sm font-bold text-gray-900">Previous Year Paper</div>
          <div className="text-xs text-gray-500 mt-0.5">138 Shift Papers (2020–2024)</div>
        </button>

        <button
          onClick={() => setExamType("subject_test")}
          className={`p-4 rounded-xl border text-left transition-all min-h-[72px] ${
            examType === "subject_test"
              ? "bg-blue-50 border-blue-500 shadow-xs"
              : "bg-white border-gray-200 hover:border-gray-300"
          }`}
        >
          <Layers className={`w-5 h-5 mb-2 ${examType === "subject_test" ? "text-blue-600" : "text-gray-400"}`} />
          <div className="text-sm font-bold text-gray-900">Topic Test</div>
          <div className="text-xs text-gray-500 mt-0.5">Quant, Reasoning, English, GA</div>
        </button>

        <button
          onClick={() => setExamType("random_test")}
          className={`p-4 rounded-xl border text-left transition-all min-h-[72px] ${
            examType === "random_test"
              ? "bg-blue-50 border-blue-500 shadow-xs"
              : "bg-white border-gray-200 hover:border-gray-300"
          }`}
        >
          <Shuffle className={`w-5 h-5 mb-2 ${examType === "random_test" ? "text-blue-600" : "text-gray-400"}`} />
          <div className="text-sm font-bold text-gray-900">Random Mock</div>
          <div className="text-xs text-gray-500 mt-0.5">Balanced 100 Qs (25 per section)</div>
        </button>
      </div>

      {/* Configurator Box */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 sm:p-5 space-y-5">
        {examType === "previous_year_paper" && (
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Select Official Paper
            </label>
            {loadingPapers ? (
              <div className="flex items-center gap-2 text-gray-400 text-xs py-3">
                <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                <span>Loading available papers...</span>
              </div>
            ) : (
              <select
                value={selectedPaperId}
                onChange={(e) => setSelectedPaperId(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-xs sm:text-sm text-gray-900 focus:outline-none focus:border-blue-500 font-medium min-h-[44px]"
              >
                {papersList.map((p, idx) => (
                  <option key={p.paper_id} value={p.paper_id}>
                    {formatPaperDisplayName(p, idx)} ({p.validated_questions} Qs)
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {examType === "subject_test" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Select Subject
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {(["Quantitative Aptitude", "General Intelligence & Reasoning", "English Comprehension", "General Awareness"] as Subject[]).map((subj) => {
                  const left = remainingBySubject(subj);
                  return (
                    <button
                      key={subj}
                      onClick={() => setSelectedSubject(subj)}
                      className={`flex items-center justify-between gap-2 p-3 rounded-lg border text-xs font-semibold text-left transition-all min-h-[44px] ${
                        selectedSubject === subj
                          ? "bg-blue-50 border-blue-500 text-blue-700"
                          : "bg-white border-gray-200 text-gray-700 hover:border-gray-300"
                      }`}
                    >
                      <span>{subj}</span>
                      {left !== null && (
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          left === 0 ? "bg-gray-100 text-gray-400" : "bg-blue-100 text-blue-700"
                        }`}>
                          {left.toLocaleString()} left
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Number of Questions
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[10, 25, 50, 100].map((cnt) => (
                  <button
                    key={cnt}
                    onClick={() => setQuestionCount(cnt)}
                    className={`py-2.5 rounded-lg text-xs font-semibold border transition-colors min-h-[44px] ${
                      questionCount === cnt
                        ? "bg-blue-600 border-blue-600 text-white"
                        : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
                    }`}
                  >
                    {cnt} Qs
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {examType === "random_test" && (
          <div className="bg-white border border-gray-200 p-4 rounded-lg text-xs text-gray-600 leading-relaxed space-y-1">
            <p className="font-semibold text-gray-900 mb-1">Random Mock Configuration</p>
            <p>• Total Questions: <strong>100 Questions</strong></p>
            <p>• Duration: <strong>60 Minutes</strong></p>
            <p>• Distribution: <strong>25 Quant • 25 Reasoning • 25 English • 25 GA</strong></p>
          </div>
        )}

        <div className="pt-2 flex justify-end">
          <button
            onClick={handleProceed}
            className="w-full sm:w-auto px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-xs min-h-[44px]"
          >
            <span>Proceed to Instructions</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TestCreationPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans flex flex-col">
      <header className="border-b border-gray-200 bg-white sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2 font-bold text-base sm:text-lg tracking-tight text-gray-900">
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-white fill-white" />
            </div>
            <span>LastMile<span className="text-blue-600">Prep</span></span>
          </Link>
          <Link href="/dashboard" className="text-xs text-gray-500 hover:text-gray-900 transition-colors font-medium">
            ← Dashboard
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8 flex-1 w-full">
        <Suspense fallback={
          <div className="flex items-center justify-center py-20 text-gray-400 gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
            <span className="text-xs">Loading...</span>
          </div>
        }>
          <TestCreationForm />
        </Suspense>
      </main>
    </div>
  );
}
