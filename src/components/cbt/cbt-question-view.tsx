"use client";

import React, { useEffect } from "react";
import { useTestStore } from "@/lib/store/use-test-store";
import { KaTeXRenderer } from "@/components/katex-renderer";
import { sanitizeQuestionText } from "@/lib/clean-text";
import { CheckCircle2, RotateCcw, Bookmark, ChevronRight, ChevronLeft, ZoomIn } from "lucide-react";
import type { ValidatedQuestion, Subject } from "@/types/database.types";

interface CBTQuestionViewProps {
  sections: Subject[];
  currentQuestion: ValidatedQuestion;
  questions: ValidatedQuestion[];
  totalQuestions: number;
}

export const CBTQuestionView: React.FC<CBTQuestionViewProps> = ({
  currentQuestion,
  totalQuestions,
}) => {
  const {
    currentQuestionIndex,
    userResponses,
    selectOption,
    clearResponse,
    saveAndNext,
    markForReviewAndNext,
    setQuestionIndex,
    timePerQuestion,
    setZoomedImage,
  } = useTestStore();

  const selectedOption = userResponses[currentQuestion.id] || null;
  const timeSpentOnCurrentQ = timePerQuestion[currentQuestion.id] || 0;

  // Options list
  const optionsList: Array<{ id: "A" | "B" | "C" | "D"; text: string }> = [
    { id: "A", text: currentQuestion.option_a || "" },
    { id: "B", text: currentQuestion.option_b || "" },
    { id: "C", text: currentQuestion.option_c || "" },
    { id: "D", text: currentQuestion.option_d || "" },
  ];

  // Derived active subject
  const activeSubject = currentQuestion.subject || "Quantitative Aptitude";

  // Keyboard Shortcuts Handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;

      const key = e.key.toUpperCase();
      if (key === "A" || key === "B" || key === "C" || key === "D") {
        selectOption(currentQuestion.id, key as "A" | "B" | "C" | "D");
      } else if (key === "ENTER") {
        e.preventDefault();
        saveAndNext(currentQuestion.id, totalQuestions);
      } else if (key === "M") {
        markForReviewAndNext(currentQuestion.id, totalQuestions);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentQuestion.id, selectOption, saveAndNext, markForReviewAndNext, totalQuestions]);

  return (
    <div className="flex-1 flex flex-col h-full bg-white overflow-hidden select-none relative">
      {/* Continuous Examination Bar: Question No + Section Badge */}
      <div className="bg-white border-b border-gray-200 px-3 sm:px-5 py-2 sm:py-3 flex flex-wrap items-center justify-between gap-2 text-xs shadow-2xs flex-shrink-0 z-10">
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <span className="font-extrabold text-gray-900 text-sm sm:text-lg tracking-tight">
            Question No. {currentQuestionIndex + 1}
          </span>
          <span className="bg-blue-50 border border-blue-200 text-blue-800 px-2.5 py-0.5 sm:py-1 rounded-md text-[11px] sm:text-xs font-bold uppercase tracking-wider truncate max-w-[180px] sm:max-w-none">
            {activeSubject}
          </span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 text-[11px] sm:text-xs">
          <span className="text-gray-500 font-mono">
            Time on Q: <strong className="text-gray-900">{timeSpentOnCurrentQ}s</strong>
          </span>
          <span className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-2 py-0.5 rounded font-bold">
            +{currentQuestion.marks?.toFixed(1) || "2.0"} Marks
          </span>
          <span className="bg-red-50 border border-red-200 text-red-600 px-2 py-0.5 rounded font-bold">
            −{currentQuestion.negative_marks?.toFixed(2) || "0.50"} Penalty
          </span>
        </div>
      </div>

      {/* Internal Scrollable Question Body */}
      <div className="flex-1 p-3.5 sm:p-7 overflow-y-auto min-h-0 space-y-4 sm:space-y-6">
        {/* Question Text (Sanitized) */}
        <div className="bg-gray-50 border border-gray-300 rounded-xl p-4 sm:p-6 text-sm sm:text-lg text-gray-900 font-medium leading-relaxed shadow-2xs">
          <KaTeXRenderer content={sanitizeQuestionText(currentQuestion.question_text)} />
        </div>

        {/* Question Image if present */}
        {currentQuestion.question_image && (
          <div className="relative group rounded-xl border border-gray-300 bg-gray-50 p-2 overflow-hidden max-w-2xl">
            <img
              src={currentQuestion.question_image}
              alt={`Question ${currentQuestionIndex + 1}`}
              className="max-h-60 sm:max-h-80 w-auto rounded-lg object-contain cursor-pointer"
              onClick={() => setZoomedImage(currentQuestion.question_image)}
            />
            <button
              onClick={() => setZoomedImage(currentQuestion.question_image)}
              className="absolute bottom-3 right-3 bg-white hover:bg-blue-50 text-gray-800 p-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-gray-300 transition-colors shadow-xs"
            >
              <ZoomIn className="w-4 h-4 text-blue-600" />
              <span>Full Screen Zoom</span>
            </button>
          </div>
        )}

        {/* Option Cards */}
        <div className="space-y-2.5 sm:space-y-3">
          <p className="text-[11px] sm:text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5">
            Select Option (Keyboard Shortcuts A / B / C / D):
          </p>
          {optionsList.map((option) => {
            const isSelected = selectedOption === option.id;
            return (
              <button
                key={option.id}
                onClick={() => selectOption(currentQuestion.id, option.id)}
                className={`w-full text-left p-3.5 sm:p-5 rounded-xl border-2 transition-all flex items-center gap-3 sm:gap-4 min-h-[52px] ${
                  isSelected
                    ? "bg-blue-50/80 border-blue-600 text-gray-900 shadow-xs"
                    : "bg-white border-gray-200 text-gray-800 hover:border-gray-400 hover:bg-gray-50"
                }`}
              >
                <div
                  className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full border-2 font-bold text-xs flex items-center justify-center flex-shrink-0 transition-colors ${
                    isSelected
                      ? "bg-blue-600 border-blue-600 text-white"
                      : "border-gray-400 text-gray-600 bg-white"
                  }`}
                >
                  {option.id}
                </div>

                <div className="flex-1 text-xs sm:text-base font-medium leading-relaxed">
                  <KaTeXRenderer content={sanitizeQuestionText(option.text)} />
                </div>

                {isSelected && <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 flex-shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Always Visible Bottom Action Bar (Row 1: Prev/Mark/Clear, Row 2: Save & Next on Mobile) */}
      <div className="bg-gray-100 border-t border-gray-300 p-2.5 sm:p-4 flex-shrink-0 z-20 shadow-md space-y-2 sm:space-y-0 sm:flex sm:items-center sm:justify-between sm:gap-3">
        {/* Top Row on Mobile / Left Group on Desktop: Prev, Mark, Clear */}
        <div className="grid grid-cols-3 gap-2 sm:flex sm:items-center sm:gap-2">
          {currentQuestionIndex > 0 ? (
            <button
              onClick={() => setQuestionIndex(currentQuestionIndex - 1)}
              className="px-2.5 sm:px-4 py-2.5 rounded-lg bg-white border border-gray-300 text-gray-700 font-bold text-xs sm:text-sm hover:bg-gray-50 transition-colors flex items-center justify-center gap-1 shadow-2xs min-h-[44px]"
              title="Previous Question"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Prev</span>
            </button>
          ) : (
            <div className="min-h-[44px] bg-gray-100 sm:hidden" />
          )}

          <button
            onClick={() => markForReviewAndNext(currentQuestion.id, totalQuestions)}
            className="px-2.5 sm:px-4 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs sm:text-sm transition-colors flex items-center justify-center gap-1 shadow-2xs min-h-[44px]"
          >
            <Bookmark className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Mark for Review & Next</span>
            <span className="sm:hidden">Mark</span>
          </button>

          <button
            onClick={() => clearResponse(currentQuestion.id)}
            className="px-2.5 sm:px-4 py-2.5 rounded-lg bg-white border border-gray-300 text-gray-700 font-bold text-xs sm:text-sm hover:bg-gray-50 transition-colors flex items-center justify-center gap-1 shadow-2xs min-h-[44px]"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Clear Response</span>
            <span className="sm:hidden">Clear</span>
          </button>
        </div>

        {/* Bottom Row on Mobile / Right Group on Desktop: Save & Next */}
        <button
          onClick={() => saveAndNext(currentQuestion.id, totalQuestions)}
          className="w-full sm:w-auto px-6 py-2.5 sm:py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm transition-colors flex items-center justify-center gap-2 shadow-xs min-h-[44px]"
        >
          <span>Save & Next</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
