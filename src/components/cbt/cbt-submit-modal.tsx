"use client";

import React from "react";
import { useTestStore } from "@/lib/store/use-test-store";
import { AlertTriangle, CheckCircle, X, ShieldAlert } from "lucide-react";
import type { ValidatedQuestion } from "@/types/database.types";

interface CBTSubmitModalProps {
  questions: ValidatedQuestion[];
  onClose: () => void;
  onConfirmSubmit: () => void;
}

export const CBTSubmitModal: React.FC<CBTSubmitModalProps> = ({
  questions,
  onClose,
  onConfirmSubmit,
}) => {
  const { questionStatuses } = useTestStore();

  let answered = 0;
  let notAnswered = 0;
  let marked = 0;
  let notVisited = 0;

  questions.forEach((q) => {
    const st = questionStatuses[q.id] || "not_visited";
    if (st === "answered" || st === "answered_marked") answered++;
    else if (st === "not_answered") notAnswered++;
    else if (st === "marked") marked++;
    else notVisited++;
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Confirm test submission"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
          <div className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-slate-50">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <span>Submit test?</span>
          </div>
          <button onClick={onClose} className="text-slate-400 transition-colors hover:text-slate-600 dark:hover:text-slate-200" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="text-sm text-slate-600 dark:text-slate-300">
          Review your attempt summary before submitting.
        </p>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <SummaryTile label="Total" value={questions.length} tone="slate" />
          <SummaryTile label="Answered" value={answered} tone="emerald" />
          <SummaryTile label="Unanswered" value={notAnswered} tone="rose" />
          <SummaryTile label="Marked" value={marked} tone="violet" />
        </div>

        <div className="flex items-start gap-2.5 rounded-xl bg-indigo-50 p-3.5 dark:bg-indigo-500/10">
          <ShieldAlert className="mt-0.5 h-4 w-4 flex-shrink-0 text-indigo-500" />
          <p className="text-xs font-medium leading-relaxed text-indigo-700 dark:text-indigo-300">
            Marking scheme: +2.0 for a correct answer, −0.50 for an incorrect one. Unanswered questions carry no penalty.
          </p>
        </div>

        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Resume Test
          </button>
          <button
            onClick={onConfirmSubmit}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-500"
          >
            <CheckCircle className="h-4 w-4" />
            <span>Confirm &amp; Submit</span>
          </button>
        </div>
      </div>
    </div>
  );
};

const tileTone: Record<string, string> = {
  slate: "bg-slate-50 text-slate-700 dark:bg-slate-800/60 dark:text-slate-200",
  emerald: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
  rose: "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400",
  violet: "bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-400",
};

const SummaryTile: React.FC<{ label: string; value: number; tone: string }> = ({ label, value, tone }) => (
  <div className={`flex items-center justify-between rounded-xl p-3 ${tileTone[tone]}`}>
    <span className="text-xs font-medium">{label}</span>
    <span className="text-base font-bold tabular-nums">{value}</span>
  </div>
);
