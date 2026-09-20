"use client";

import React, { useMemo } from "react";
import { useTestStore, type QuestionStatus } from "@/lib/store/use-test-store";
import { CheckCircle2, X, Lock } from "lucide-react";
import type { ValidatedQuestion } from "@/types/database.types";

interface CBTPaletteProps {
  questions: ValidatedQuestion[];
  onSubmitClick: () => void;
  onSelectQuestion?: () => void;
  onCloseDrawer?: () => void;
  isDrawer?: boolean;
}

export const CBTPalette: React.FC<CBTPaletteProps> = ({
  questions,
  onSubmitClick,
  onSelectQuestion,
  onCloseDrawer,
  isDrawer = false,
}) => {
  const {
    currentQuestionIndex,
    setQuestionIndex,
    questionStatuses,
    sections,
    activeSectionIndex,
  } = useTestStore();

  const activeSection = sections[activeSectionIndex];
  const secStart = activeSection ? activeSection.startIndex : 0;
  const secEnd = activeSection ? activeSection.startIndex + activeSection.count - 1 : questions.length - 1;

  // Only the active section's questions are reachable in the palette.
  const sectionQuestions = useMemo(
    () => questions.slice(secStart, secEnd + 1),
    [questions, secStart, secEnd]
  );

  const counts = useMemo(() => {
    let answered = 0, notAnswered = 0, notVisited = 0, marked = 0, answeredMarked = 0;
    sectionQuestions.forEach((q) => {
      const st = questionStatuses[q.id] || "not_visited";
      if (st === "answered") answered++;
      else if (st === "not_answered") notAnswered++;
      else if (st === "not_visited") notVisited++;
      else if (st === "marked") marked++;
      else if (st === "answered_marked") answeredMarked++;
    });
    return { answered, notAnswered, notVisited, marked, answeredMarked };
  }, [sectionQuestions, questionStatuses]);

  const handleQuestionClick = (globalIdx: number) => {
    setQuestionIndex(globalIdx);
    onSelectQuestion?.();
  };

  const cellClass = (status: QuestionStatus, isCurrent: boolean) => {
    const base =
      "relative flex h-9 w-9 items-center justify-center text-xs font-semibold tabular-nums transition-all min-h-[36px] min-w-[36px] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-slate-900";
    const ring = isCurrent ? " ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-slate-900 z-10" : "";
    switch (status) {
      case "answered":
        return `${base} rounded-lg bg-emerald-500 text-white${ring}`;
      case "not_answered":
        return `${base} rounded-lg bg-rose-500 text-white${ring}`;
      case "marked":
        return `${base} rounded-full bg-violet-500 text-white${ring}`;
      case "answered_marked":
        return `${base} rounded-full bg-violet-500 text-white${ring}`;
      default:
        return `${base} rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700${ring}`;
    }
  };

  const isLastSection = activeSectionIndex >= sections.length - 1;

  return (
    <div className="flex h-full w-full flex-col overflow-hidden border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 lg:border-l">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
        <div>
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            Section {activeSectionIndex + 1} of {sections.length || 1}
          </h2>
          <p className="text-xs text-slate-400">{activeSection?.name || "Questions"}</p>
        </div>
        {isDrawer && onCloseDrawer && (
          <button
            onClick={onCloseDrawer}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
            aria-label="Close question palette"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Section progress pills: done (locked), active, upcoming */}
      {sections.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto border-b border-slate-200 px-4 py-2.5 dark:border-slate-800">
          {sections.map((s, i) => {
            const state = i < activeSectionIndex ? "locked" : i === activeSectionIndex ? "active" : "upcoming";
            return (
              <div
                key={s.name + i}
                className={`flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-1 text-[10px] font-semibold ${
                  state === "active"
                    ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300"
                    : state === "locked"
                      ? "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500"
                      : "border border-dashed border-slate-300 text-slate-400 dark:border-slate-700 dark:text-slate-500"
                }`}
                title={s.name}
              >
                {state === "locked" && <Lock className="h-2.5 w-2.5" />}
                {i + 1}
              </div>
            );
          })}
        </div>
      )}

      {/* Legend */}
      <div className="grid grid-cols-2 gap-2 border-b border-slate-200 px-4 py-3 text-[11px] dark:border-slate-800">
        <Legend color="bg-emerald-500" label="Answered" count={counts.answered} />
        <Legend color="bg-rose-500" label="Not answered" count={counts.notAnswered} />
        <Legend color="border border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-800" label="Not visited" count={counts.notVisited} />
        <Legend color="bg-violet-500" round label="Marked" count={counts.marked + counts.answeredMarked} />
      </div>

      {/* Grid, active section only */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-5 gap-2">
          {sectionQuestions.map((q, localIdx) => {
            const globalIdx = secStart + localIdx;
            const st = questionStatuses[q.id] || "not_visited";
            const isCurrent = globalIdx === currentQuestionIndex;
            return (
              <button
                key={q.id}
                onClick={() => handleQuestionClick(globalIdx)}
                className={cellClass(st, isCurrent)}
                title={`Question ${localIdx + 1}`}
                aria-current={isCurrent ? "true" : undefined}
              >
                {localIdx + 1}
                {st === "answered_marked" && (
                  <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-400 dark:border-slate-900" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Submit whole test */}
      <div className="border-t border-slate-200 p-4 dark:border-slate-800">
        <button
          onClick={() => {
            onCloseDrawer?.();
            onSubmitClick();
          }}
          className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 active:scale-[0.99]"
        >
          <CheckCircle2 className="h-4 w-4" />
          <span>{isLastSection ? "Submit test" : "Submit whole test"}</span>
        </button>
      </div>
    </div>
  );
};

const Legend: React.FC<{ color: string; label: string; count: number; round?: boolean }> = ({
  color,
  label,
  count,
  round,
}) => (
  <div className="flex items-center gap-1.5">
    <span
      className={`flex h-5 w-5 items-center justify-center text-[10px] font-bold text-white ${color} ${
        round ? "rounded-full" : "rounded"
      } ${color.includes("bg-white") || color.includes("dark:bg-slate-800") ? "!text-slate-600 dark:!text-slate-300" : ""}`}
    >
      {count}
    </span>
    <span className="text-slate-600 dark:text-slate-400">{label}</span>
  </div>
);
