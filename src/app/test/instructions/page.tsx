"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Zap,
  User,
  FileText,
  Clock,
  AlertTriangle,
  Play,
  Loader2,
  BookOpen,
  Calculator,
  Eye,
  Keyboard,
  ShieldAlert,
} from "lucide-react";
import { useTestStore } from "@/lib/store/use-test-store";

function InstructionsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { initTest, resetTest } = useTestStore();

  const examType = searchParams.get("exam_type") || "previous_year_paper";
  const paperId = searchParams.get("paper_id") || "";
  const title = searchParams.get("title") || "SSC CGL Practice Test";
  const subject = searchParams.get("subject") || "";
  const questionCount = parseInt(searchParams.get("questions") || "100");
  const timeLimitMinutes = parseInt(searchParams.get("time") || "60");

  const [confirmed, setConfirmed] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStartExam = async () => {
    if (!confirmed) return;
    setStarting(true);
    setError(null);

    try {
      const payload: Record<string, unknown> = {
        exam_type: examType,
        total_questions: questionCount,
        time_limit_minutes: timeLimitMinutes,
        title,
      };
      if (paperId) payload.paper_id = paperId;
      if (subject) payload.subject = subject;

      const res = await fetch("/api/cbt/exams/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to start exam");
      }

      resetTest();
      initTest(
        data.attempt_id,
        data.attempt_id,
        data.questions.map((q: { id: string }) => q.id),
        Math.round(data.time_limit_seconds / 60)
      );

      router.push(`/test/${data.attempt_id}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to start exam";
      console.error("Start exam error:", err);
      setError(message);
      setStarting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-5">
      {/* Title */}
      <div className="border-b border-gray-300 pb-3 text-center">
        <h1 className="text-xl font-bold text-gray-900 uppercase tracking-wide">STAFF SELECTION COMMISSION</h1>
        <h2 className="text-sm font-semibold text-gray-700">Combined Graduate Level Examination (CGL)</h2>
        <p className="text-xs text-gray-500 mt-0.5">Computer Based Test (CBT) Candidate Instructions</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2 text-red-700 text-xs font-medium">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Grid: Candidate & Paper Details */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Candidate Details */}
        <div className="bg-white border border-gray-300 rounded-lg p-4 space-y-2">
          <div className="flex items-center gap-2 font-bold text-xs text-gray-800 border-b border-gray-200 pb-2">
            <User className="w-4 h-4 text-blue-600" />
            <span>1. Candidate Details</span>
          </div>
          <table className="w-full text-xs text-gray-700">
            <tbody>
              <tr><td className="py-1 text-gray-500">Candidate Name:</td><td className="py-1 font-semibold text-gray-900">SSC Aspirant</td></tr>
              <tr><td className="py-1 text-gray-500">Roll Number:</td><td className="py-1 font-semibold text-gray-900">2201948102</td></tr>
              <tr><td className="py-1 text-gray-500">Exam Center:</td><td className="py-1 font-semibold text-gray-900">Digital Assessment Zone (iON Code 8401)</td></tr>
            </tbody>
          </table>
        </div>

        {/* Paper Details */}
        <div className="bg-white border border-gray-300 rounded-lg p-4 space-y-2">
          <div className="flex items-center gap-2 font-bold text-xs text-gray-800 border-b border-gray-200 pb-2">
            <FileText className="w-4 h-4 text-blue-600" />
            <span>2. Paper Details</span>
          </div>
          <table className="w-full text-xs text-gray-700">
            <tbody>
              <tr><td className="py-1 text-gray-500">Test Title:</td><td className="py-1 font-semibold text-gray-900 truncate">{title}</td></tr>
              <tr><td className="py-1 text-gray-500">Total Questions:</td><td className="py-1 font-semibold text-gray-900">{questionCount} Questions</td></tr>
              <tr><td className="py-1 text-gray-500">Duration:</td><td className="py-1 font-semibold text-gray-900">{timeLimitMinutes} Minutes</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Rules & Marking Scheme */}
      <div className="bg-white border border-gray-300 rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-2 font-bold text-xs text-gray-800 border-b border-gray-200 pb-2">
          <BookOpen className="w-4 h-4 text-blue-600" />
          <span>3. Duration & Marking Scheme</span>
        </div>
        <div className="text-xs text-gray-700 space-y-1.5 leading-relaxed">
          <p>• Total time limit for the examination is <strong>{timeLimitMinutes} minutes</strong>.</p>
          <p>• Correct Answer: <strong>+2.0 Marks</strong> | Incorrect Answer: <strong>−0.50 Negative Marks</strong> | Unanswered: <strong>0 Marks</strong>.</p>
          <p>• The server clock will count down remaining time at the top right of your screen.</p>
        </div>
      </div>

      {/* Question Palette Colors */}
      <div className="bg-white border border-gray-300 rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-2 font-bold text-xs text-gray-800 border-b border-gray-200 pb-2">
          <Eye className="w-4 h-4 text-blue-600" />
          <span>4. Question Palette Legend</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
          <div className="flex items-center gap-2 bg-gray-50 p-2 rounded border border-gray-200">
            <span className="w-6 h-6 bg-white border border-gray-300 rounded text-gray-600 font-bold flex items-center justify-center text-xs">1</span>
            <span className="text-gray-700 font-medium">Not Visited</span>
          </div>
          <div className="flex items-center gap-2 bg-gray-50 p-2 rounded border border-gray-200">
            <span className="w-6 h-6 bg-red-500 text-white rounded font-bold flex items-center justify-center text-xs">2</span>
            <span className="text-gray-700 font-medium">Not Answered</span>
          </div>
          <div className="flex items-center gap-2 bg-gray-50 p-2 rounded border border-gray-200">
            <span className="w-6 h-6 bg-emerald-500 text-white rounded font-bold flex items-center justify-center text-xs">3</span>
            <span className="text-gray-700 font-medium">Answered</span>
          </div>
          <div className="flex items-center gap-2 bg-gray-50 p-2 rounded border border-gray-200">
            <span className="w-6 h-6 bg-violet-500 text-white rounded-full font-bold flex items-center justify-center text-xs">4</span>
            <span className="text-gray-700 font-medium">Marked</span>
          </div>
          <div className="flex items-center gap-2 bg-gray-50 p-2 rounded border border-gray-200 col-span-2 sm:col-span-1">
            <span className="relative w-6 h-6 bg-violet-500 text-white rounded-full font-bold flex items-center justify-center text-xs">
              5
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-400 rounded-full" />
            </span>
            <span className="text-gray-700 font-medium">Ans & Marked</span>
          </div>
        </div>
      </div>

      {/* Navigation & Shortcuts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-300 rounded-lg p-4 space-y-2">
          <div className="flex items-center gap-2 font-bold text-xs text-gray-800 border-b border-gray-200 pb-2">
            <FileText className="w-4 h-4 text-blue-600" />
            <span>5. Navigation Controls</span>
          </div>
          <ul className="text-xs text-gray-700 space-y-1 list-disc list-inside">
            <li>Click <strong>Save & Next</strong> to save answer and move forward.</li>
            <li>Click <strong>Mark for Review & Next</strong> to review later.</li>
            <li>Click <strong>Clear Response</strong> to deselect chosen option.</li>
          </ul>
        </div>

        <div className="bg-white border border-gray-300 rounded-lg p-4 space-y-2">
          <div className="flex items-center gap-2 font-bold text-xs text-gray-800 border-b border-gray-200 pb-2">
            <Keyboard className="w-4 h-4 text-blue-600" />
            <span>6. Keyboard Shortcuts</span>
          </div>
          <ul className="text-xs text-gray-700 space-y-1">
            <li><kbd className="bg-gray-100 border border-gray-300 px-1.5 py-0.5 rounded font-mono">A/B/C/D</kbd> — Select Option</li>
            <li><kbd className="bg-gray-100 border border-gray-300 px-1.5 py-0.5 rounded font-mono">Enter</kbd> — Save & Next</li>
            <li><kbd className="bg-gray-100 border border-gray-300 px-1.5 py-0.5 rounded font-mono">M</kbd> — Mark for Review</li>
          </ul>
        </div>
      </div>

      {/* Final Warning & Confirmation */}
      <div className="bg-gray-50 border border-gray-300 rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-2 font-bold text-xs text-amber-800">
          <ShieldAlert className="w-4 h-4 text-amber-600" />
          <span>7. Final Warning & Declaration</span>
        </div>
        <p className="text-xs text-gray-700 leading-relaxed">
          Ensure you do not close or refresh the window during the test. Your answers are auto-saved in real-time.
        </p>

        <label className="flex items-start gap-2.5 cursor-pointer select-none pt-1">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
          />
          <span className="text-xs text-gray-900 font-semibold leading-relaxed">
            I have read and understood all instructions. I am ready to begin the examination.
          </span>
        </label>

        <div className="flex items-center gap-3 pt-2">
          <Link
            href="/test/create"
            className="px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 font-semibold text-xs transition-colors"
          >
            ← Back
          </Link>
          <button
            disabled={!confirmed || starting}
            onClick={handleStartExam}
            className="flex-1 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-bold text-xs transition-colors flex items-center justify-center gap-2 shadow-xs"
          >
            {starting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Initializing CBT Software...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-white" />
                <span>Begin Test Now</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function InstructionsPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans flex flex-col antialiased">
      <header className="border-b border-gray-200 bg-white sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-lg text-gray-900">
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-white fill-white" />
            </div>
            <span>Staff Selection Commission CBT</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
            <Clock className="w-4 h-4" />
            <span>Instructions</span>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <Suspense fallback={
          <div className="flex items-center justify-center py-20 text-gray-400 gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
            <span className="text-xs">Loading instructions...</span>
          </div>
        }>
          <InstructionsContent />
        </Suspense>
      </main>
    </div>
  );
}
