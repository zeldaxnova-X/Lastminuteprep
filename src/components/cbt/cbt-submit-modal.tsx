"use client";

import React, { useMemo } from "react";
import { useTestStore } from "@/lib/store/use-test-store";
import { sectionLabel } from "@/lib/cbt-questions";
import { AlertTriangle, CheckCircle, X, ShieldAlert } from "lucide-react";
import type { ValidatedQuestion } from "@/types/database.types";

interface CBTSubmitModalProps {
  questions: ValidatedQuestion[];
  onClose: () => void;
  onConfirmSubmit: () => void;
}

interface Counts {
  total: number;
  answered: number;
  notAnswered: number;
  marked: number;
  answeredMarked: number;
  notVisited: number;
}

const emptyCounts = (): Counts => ({
  total: 0,
  answered: 0,
  notAnswered: 0,
  marked: 0,
  answeredMarked: 0,
  notVisited: 0,
});

export const CBTSubmitModal: React.FC<CBTSubmitModalProps> = ({
  questions,
  onClose,
  onConfirmSubmit,
}) => {
  const { questionStatuses } = useTestStore();

  const { overall, sections } = useMemo(() => {
    const overall = emptyCounts();
    const sections = new Map<string, Counts>();
    for (const q of questions) {
      const key = sectionLabel(
        (q.section as string) || (q.subject as string) || "General"
      );
      if (!sections.has(key)) sections.set(key, emptyCounts());
      const sec = sections.get(key)!;
      const st = questionStatuses[q.id] || "not_visited";

      overall.total++;
      sec.total++;
      const bump = (k: keyof Counts) => {
        overall[k]++;
        sec[k]++;
      };
      if (st === "answered") bump("answered");
      else if (st === "answered_marked") bump("answeredMarked");
      else if (st === "not_answered") bump("notAnswered");
      else if (st === "marked") bump("marked");
      else bump("notVisited");
    }
    return { overall, sections: [...sections.entries()] };
  }, [questions, questionStatuses]);

  const evaluated = overall.answered + overall.answeredMarked;

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
        className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
          <div className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-slate-50">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <span>Submit test?</span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 transition-colors hover:text-slate-600 dark:hover:text-slate-200"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Review your section-wise summary before submitting. Only saved answers
            (including <span className="font-medium">Answered &amp; Marked</span>)
            are evaluated.
          </p>

          {/* Per-section summary table */}
          <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                  <th className="px-3 py-2 text-left font-semibold">Section</th>
                  <Th title="Answered">Ans</Th>
                  <Th title="Not Answered">Not</Th>
                  <Th title="Marked for Review">Mrk</Th>
                  <Th title="Answered & Marked">A+M</Th>
                  <Th title="Not Visited">NV</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {sections.map(([name, c]) => (
                  <tr key={name} className="text-slate-700 dark:text-slate-200">
                    <td className="px-3 py-2 font-medium">{name}</td>
                    <Td tone="emerald">{c.answered}</Td>
                    <Td tone="rose">{c.notAnswered}</Td>
                    <Td tone="violet">{c.marked}</Td>
                    <Td tone="violet">{c.answeredMarked}</Td>
                    <Td tone="slate">{c.notVisited}</Td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-200 bg-slate-50 font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100">
                  <td className="px-3 py-2">Total</td>
                  <Td tone="emerald">{overall.answered}</Td>
                  <Td tone="rose">{overall.notAnswered}</Td>
                  <Td tone="violet">{overall.marked}</Td>
                  <Td tone="violet">{overall.answeredMarked}</Td>
                  <Td tone="slate">{overall.notVisited}</Td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3.5 py-2.5 text-sm dark:bg-slate-800/60">
            <span className="text-slate-600 dark:text-slate-300">
              Questions that will be evaluated
            </span>
            <span className="tabular-nums font-bold text-slate-900 dark:text-slate-50">
              {evaluated} / {overall.total}
            </span>
          </div>

          <div className="flex items-start gap-2.5 rounded-xl bg-indigo-50 p-3.5 dark:bg-indigo-500/10">
            <ShieldAlert className="mt-0.5 h-4 w-4 flex-shrink-0 text-indigo-500" />
            <p className="text-xs font-medium leading-relaxed text-indigo-700 dark:text-indigo-300">
              Marking scheme: +2.0 for a correct answer, −0.50 for an incorrect
              one. Unanswered questions carry no penalty.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 border-t border-slate-100 px-6 py-4 dark:border-slate-800">
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

const Th: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <th className="px-2 py-2 text-center font-semibold" title={title}>
    {children}
  </th>
);

const tdTone: Record<string, string> = {
  emerald: "text-emerald-600 dark:text-emerald-400",
  rose: "text-rose-500 dark:text-rose-400",
  violet: "text-violet-600 dark:text-violet-400",
  slate: "text-slate-500 dark:text-slate-400",
};

const Td: React.FC<{ tone: string; children: React.ReactNode }> = ({ tone, children }) => (
  <td className={`px-2 py-2 text-center tabular-nums font-semibold ${tdTone[tone]}`}>
    {children}
  </td>
);
