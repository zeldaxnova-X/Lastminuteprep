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
    <div className="fixed inset-0 z-50 bg-gray-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-gray-200 rounded-2xl max-w-md w-full p-6 shadow-xl space-y-6">
        <div className="flex items-center justify-between border-b border-gray-100 pb-4">
          <div className="flex items-center gap-2 font-bold text-gray-900 text-lg">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            <span>Confirm Test Submission</span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-gray-600">
          Are you sure you want to submit your test? Review your attempt summary below:
        </p>

        {/* Summary Grid */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="bg-gray-50 border border-gray-200 p-3 rounded-xl flex items-center justify-between">
            <span className="text-gray-500 text-xs font-medium">Total Questions</span>
            <span className="font-bold text-gray-900">{questions.length}</span>
          </div>

          <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl flex items-center justify-between">
            <span className="text-emerald-700 text-xs font-medium">Answered</span>
            <span className="font-bold text-emerald-700">{answered}</span>
          </div>

          <div className="bg-red-50 border border-red-200 p-3 rounded-xl flex items-center justify-between">
            <span className="text-red-700 text-xs font-medium">Unanswered</span>
            <span className="font-bold text-red-700">{notAnswered}</span>
          </div>

          <div className="bg-violet-50 border border-violet-200 p-3 rounded-xl flex items-center justify-between">
            <span className="text-violet-700 text-xs font-medium">Marked for Review</span>
            <span className="font-bold text-violet-700">{marked}</span>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-100 p-3.5 rounded-xl flex items-start gap-2.5">
          <ShieldAlert className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-blue-700 leading-relaxed font-medium">
            SSC Marking Scheme: +2.0 marks for correct answers, -0.50 negative penalty for incorrect answers.
          </p>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 font-semibold text-sm transition-colors"
          >
            Resume Test
          </button>
          <button
            onClick={onConfirmSubmit}
            className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-sm transition-colors flex items-center justify-center gap-2"
          >
            <CheckCircle className="w-4 h-4" />
            <span>Confirm & Submit</span>
          </button>
        </div>
      </div>
    </div>
  );
};
