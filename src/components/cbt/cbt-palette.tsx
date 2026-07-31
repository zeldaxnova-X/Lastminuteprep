"use client";

import React, { useMemo } from "react";
import { useTestStore, type QuestionStatus } from "@/lib/store/use-test-store";
import { User, CheckCircle2 } from "lucide-react";
import type { ValidatedQuestion } from "@/types/database.types";

interface CBTPaletteProps {
  questions: ValidatedQuestion[];
  onSubmitClick: () => void;
}

export const CBTPalette: React.FC<CBTPaletteProps> = ({ questions, onSubmitClick }) => {
  const { currentQuestionIndex, setQuestionIndex, questionStatuses } = useTestStore();

  const statusCounts = useMemo(() => {
    let answered = 0, notAnswered = 0, notVisited = 0, marked = 0, answeredMarked = 0;
    questions.forEach((q) => {
      const st = questionStatuses[q.id] || "not_visited";
      if (st === "answered") answered++;
      else if (st === "not_answered") notAnswered++;
      else if (st === "not_visited") notVisited++;
      else if (st === "marked") marked++;
      else if (st === "answered_marked") answeredMarked++;
    });
    return { answered, notAnswered, notVisited, marked, answeredMarked };
  }, [questions, questionStatuses]);

  const getStatusBadge = (status: QuestionStatus, isCurrent: boolean, num: number) => {
    let baseStyles = "relative w-9 h-9 sm:w-10 sm:h-10 text-xs font-bold flex items-center justify-center transition-all cursor-pointer select-none border shadow-2xs min-h-[36px] min-w-[36px] ";
    if (isCurrent) baseStyles += "ring-2 ring-blue-600 ring-offset-2 scale-105 z-10 ";

    switch (status) {
      case "answered":
        return (
          <button key={num} onClick={() => setQuestionIndex(num - 1)}
            className={`${baseStyles} bg-emerald-600 border-emerald-700 text-white rounded`} title={`Q${num}: Answered`}>{num}</button>
        );
      case "not_answered":
        return (
          <button key={num} onClick={() => setQuestionIndex(num - 1)}
            className={`${baseStyles} bg-red-600 border-red-700 text-white rounded`} title={`Q${num}: Not Answered`}>{num}</button>
        );
      case "marked":
        return (
          <button key={num} onClick={() => setQuestionIndex(num - 1)}
            className={`${baseStyles} bg-purple-600 border-purple-700 text-white rounded-full`} title={`Q${num}: Marked for Review`}>{num}</button>
        );
      case "answered_marked":
        return (
          <button key={num} onClick={() => setQuestionIndex(num - 1)}
            className={`${baseStyles} bg-purple-600 border-purple-700 text-white rounded-full`} title={`Q${num}: Answered & Marked`}>
            {num}
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 border-2 border-white rounded-full" />
          </button>
        );
      case "not_visited":
      default:
        return (
          <button key={num} onClick={() => setQuestionIndex(num - 1)}
            className={`${baseStyles} bg-white text-gray-700 border-gray-300 rounded hover:bg-gray-100`} title={`Q${num}: Not Visited`}>{num}</button>
        );
    }
  };

  return (
    <div className="bg-gray-50 border-t lg:border-t-0 lg:border-l border-gray-300 w-full lg:w-80 flex flex-col max-h-[350px] lg:max-h-none lg:h-full overflow-hidden select-none">
      {/* Candidate Banner */}
      <div className="p-2.5 sm:p-3 bg-white border-b border-gray-200 flex items-center justify-between lg:justify-start gap-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center">
            <User className="w-3.5 h-3.5" />
          </div>
          <div>
            <span className="text-xs font-bold text-gray-900 block">Candidate: SSC Aspirant</span>
            <span className="text-[10px] text-gray-500">Roll No: 2201948102</span>
          </div>
        </div>
      </div>

      {/* Official SSC Color Legend */}
      <div className="p-2.5 sm:p-3 bg-white border-b border-gray-200 text-xs space-y-2">
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-2 text-[11px]">
          <div className="flex items-center gap-1.5">
            <span className="w-4 h-4 sm:w-5 sm:h-5 bg-emerald-600 text-white font-bold rounded flex items-center justify-center text-[10px]">{statusCounts.answered}</span>
            <span className="text-gray-700 font-medium">Answered</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="w-4 h-4 sm:w-5 sm:h-5 bg-red-600 text-white font-bold rounded flex items-center justify-center text-[10px]">{statusCounts.notAnswered}</span>
            <span className="text-gray-700 font-medium">Not Answered</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="w-4 h-4 sm:w-5 sm:h-5 bg-white border border-gray-300 text-gray-700 font-bold rounded flex items-center justify-center text-[10px]">{statusCounts.notVisited}</span>
            <span className="text-gray-700 font-medium">Not Visited</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="w-4 h-4 sm:w-5 sm:h-5 bg-purple-600 text-white font-bold rounded-full flex items-center justify-center text-[10px]">{statusCounts.marked}</span>
            <span className="text-gray-700 font-medium">Marked</span>
          </div>
        </div>
      </div>

      {/* Palette Title */}
      <div className="px-3 py-1.5 sm:py-2 bg-gray-100 border-b border-gray-200 text-[11px] font-bold text-gray-600 uppercase tracking-wider flex items-center justify-between">
        <span>Question Palette</span>
        <span className="text-blue-700 font-semibold">{questions.length} Questions</span>
      </div>

      {/* Grid */}
      <div className="flex-1 p-2.5 sm:p-3 overflow-y-auto">
        <div className="grid grid-cols-6 sm:grid-cols-10 lg:grid-cols-5 gap-1.5 sm:gap-2">
          {questions.map((q, idx) => {
            const st = questionStatuses[q.id] || "not_visited";
            return getStatusBadge(st, idx === currentQuestionIndex, idx + 1);
          })}
        </div>
      </div>

      {/* Submit CTA */}
      <div className="p-2.5 sm:p-3 bg-white border-t border-gray-300">
        <button
          onClick={onSubmitClick}
          className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-colors flex items-center justify-center gap-2 shadow-xs uppercase tracking-wider min-h-[44px]"
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>Submit Test</span>
        </button>
      </div>
    </div>
  );
};
