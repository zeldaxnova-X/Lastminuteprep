"use client";

import React, { useEffect, useMemo, useRef, useCallback } from "react";
import { useTestStore, type Confidence } from "@/lib/store/use-test-store";
import { QuestionContent } from "@/components/cbt/question-content";
import { MentorPanel, TrickPanel, type QuestionTrick } from "@/components/cbt/insight-panels";
import { sectionLabel } from "@/lib/cbt-questions";
import {
  RotateCcw,
  Flag,
  ChevronRight,
  ChevronLeft,
  Bookmark,
  Keyboard,
  SlidersHorizontal,
  Check,
  Lock,
} from "lucide-react";
import type {
  ValidatedQuestion,
  Subject,
  QuestionContentBlock,
  QuestionOptionRich,
  CorrectAnswer,
} from "@/types/database.types";

interface CBTQuestionViewProps {
  sections: Subject[];
  currentQuestion: ValidatedQuestion;
  questions: ValidatedQuestion[];
  totalQuestions: number;
}

const OPTION_KEYS: CorrectAnswer[] = ["A", "B", "C", "D"];

/**
 * Optional "study aids" — extras that are NOT part of the authentic SSC CGL CBT.
 * All OFF by default so the exam screen matches the real test the first time;
 * a candidate can switch any on from the in-exam settings menu if they want it.
 * Confidence & speed live in the report + MarksenseAI, not on the live screen.
 *   confidence — the 3-way confidence capture near Save (feeds MarksenseAI)
 *   timer      — the per-question "Xs on this question" readout (speed is always
 *                tracked silently for the report; this only shows it live)
 *   insights   — the Trick-to-higher-scores + Virtual Mentor panels
 */
type StudyAids = { confidence: boolean; timer: boolean; insights: boolean };
const STUDY_AIDS_DEFAULT: StudyAids = { confidence: false, timer: false, insights: false };
const STUDY_AIDS_KEY = "lmp_cbt_study_aids_v1";

function useStudyAids(): [StudyAids, (k: keyof StudyAids) => void] {
  const [aids, setAids] = React.useState<StudyAids>(STUDY_AIDS_DEFAULT);
  // Load once on mount (client only). Wrapped: storage can throw / be absent.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STUDY_AIDS_KEY);
      if (raw) setAids({ ...STUDY_AIDS_DEFAULT, ...(JSON.parse(raw) as Partial<StudyAids>) });
    } catch {
      /* ignore, keep defaults */
    }
  }, []);
  const toggle = useCallback((k: keyof StudyAids) => {
    setAids((prev) => {
      const next = { ...prev, [k]: !prev[k] };
      try {
        localStorage.setItem(STUDY_AIDS_KEY, JSON.stringify(next));
      } catch {
        /* best-effort */
      }
      return next;
    });
  }, []);
  return [aids, toggle];
}

/** Build renderable stem blocks, falling back to legacy flat fields. */
function useStemBlocks(q: ValidatedQuestion): QuestionContentBlock[] {
  return useMemo(() => {
    if (q.stem && q.stem.length > 0) return q.stem;
    const blocks: QuestionContentBlock[] = [];
    if (q.question_text?.trim()) blocks.push({ kind: "text", text: q.question_text });
    if (q.question_image) blocks.push({ kind: "image", url: q.question_image });
    return blocks;
  }, [q]);
}

/** Build renderable options, falling back to legacy flat fields. */
function useOptions(q: ValidatedQuestion): QuestionOptionRich[] {
  return useMemo(() => {
    if (q.rich_options && q.rich_options.length > 0) return q.rich_options;
    const flat = [q.option_a, q.option_b, q.option_c, q.option_d];
    return OPTION_KEYS.map((key, i) => ({
      key,
      index: i + 1,
      text: flat[i] ?? "",
      isImage: false,
      blocks: flat[i]?.trim() ? [{ kind: "text" as const, text: flat[i]! }] : [],
    }));
  }, [q]);
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
    lockCurrentSection,
    timePerQuestion,
    setZoomedImage,
    questionStatuses,
    confidences,
    setConfidence,
    sections,
    activeSectionIndex,
  } = useTestStore();

  // Active section bounds: navigation is scoped to the open section only.
  const activeSection = sections[activeSectionIndex];
  const secStart = activeSection ? activeSection.startIndex : 0;
  const secEnd = activeSection ? activeSection.startIndex + activeSection.count - 1 : totalQuestions - 1;
  const secCount = activeSection ? activeSection.count : totalQuestions;
  const localIndex = currentQuestionIndex - secStart; // 0-based within section
  const isLastSection = activeSectionIndex >= sections.length - 1;

  // Optional study aids (all off by default → authentic CBT on first load).
  const [aids, toggleAid] = useStudyAids();
  const [prefsOpen, setPrefsOpen] = React.useState(false);
  const [confirmLock, setConfirmLock] = React.useState(false);

  const selectedOption = userResponses[currentQuestion.id] || null;
  const confidence = confidences[currentQuestion.id] ?? "unsure";
  const timeSpent = timePerQuestion[currentQuestion.id] || 0;
  const status = questionStatuses[currentQuestion.id];
  const isMarked = status === "marked" || status === "answered_marked";

  const stemBlocks = useStemBlocks(currentQuestion);
  const options = useOptions(currentQuestion);
  const label = sectionLabel(currentQuestion.section || currentQuestion.subject);

  // Bookmark is an extension point: local, optimistic, best-effort persistence.
  const [bookmarked, setBookmarked] = React.useState(false);
  useEffect(() => setBookmarked(false), [currentQuestion.id]);
  const toggleBookmark = useCallback(() => {
    setBookmarked((b) => !b);
    // Wire to /api/cbt/bookmarks when auth context is available.
  }, []);

  const optionRefs = useRef<(HTMLDivElement | null)[]>([]);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Scroll to top when the question changes.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [currentQuestion.id]);

  // Global keyboard shortcuts (ignored while typing in a field).
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable))
        return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const key = e.key;
      const upper = key.toUpperCase();

      if (["A", "B", "C", "D"].includes(upper)) {
        selectOption(currentQuestion.id, upper as CorrectAnswer);
      } else if (["1", "2", "3", "4"].includes(key)) {
        selectOption(currentQuestion.id, OPTION_KEYS[Number(key) - 1]);
      } else if (key === "Enter") {
        e.preventDefault();
        saveAndNext(currentQuestion.id);
      } else if (upper === "M") {
        markForReviewAndNext(currentQuestion.id);
      } else if (upper === "C") {
        clearResponse(currentQuestion.id);
      } else if (upper === "B") {
        toggleBookmark();
      } else if (key === "ArrowRight") {
        if (currentQuestionIndex < secEnd) setQuestionIndex(currentQuestionIndex + 1);
      } else if (key === "ArrowLeft") {
        if (currentQuestionIndex > secStart) setQuestionIndex(currentQuestionIndex - 1);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    currentQuestion.id,
    currentQuestionIndex,
    secStart,
    secEnd,
    selectOption,
    saveAndNext,
    markForReviewAndNext,
    clearResponse,
    setQuestionIndex,
    toggleBookmark,
  ]);

  // Roving arrow-key navigation within the option radiogroup.
  const onOptionKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const dir = e.key === "ArrowDown" ? 1 : -1;
      const next = (index + dir + options.length) % options.length;
      optionRefs.current[next]?.focus();
    } else if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      selectOption(currentQuestion.id, options[index].key);
    }
  };

  const tricks = (currentQuestion as unknown as { tricks?: QuestionTrick[] }).tricks;

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col bg-slate-50 dark:bg-slate-950">
      {/* Question meta bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white/80 px-4 py-2.5 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/80 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-50 sm:text-base">
            Question <span className="tabular-nums">{localIndex + 1}</span>
            <span className="font-normal text-slate-400"> of {secCount}</span>
          </span>
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300 sm:text-xs">
            {label}
          </span>
        </div>
        <div className="flex items-center gap-2 text-[11px] sm:text-xs">
          {aids.timer && (
            <span className="tabular-nums text-slate-400">{timeSpent}s on this question</span>
          )}
          <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 font-semibold text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
            +{(currentQuestion.marks ?? 2).toFixed(1)}
          </span>
          <span className="rounded-md bg-rose-50 px-1.5 py-0.5 font-semibold text-rose-500 dark:bg-rose-500/10 dark:text-rose-400">
            −{(currentQuestion.negative_marks ?? 0.5).toFixed(2)}
          </span>
          <button
            type="button"
            onClick={toggleBookmark}
            aria-pressed={bookmarked}
            aria-label={bookmarked ? "Remove bookmark" : "Bookmark this question"}
            className={`flex h-7 w-7 items-center justify-center rounded-lg border transition ${
              bookmarked
                ? "border-amber-300 bg-amber-50 text-amber-500 dark:border-amber-500/40 dark:bg-amber-500/10"
                : "border-slate-200 text-slate-400 hover:text-slate-600 dark:border-slate-700 dark:hover:text-slate-200"
            }`}
          >
            <Bookmark className={`h-4 w-4 ${bookmarked ? "fill-current" : ""}`} />
          </button>
          <StudyAidsMenu open={prefsOpen} setOpen={setPrefsOpen} aids={aids} toggleAid={toggleAid} />
        </div>
      </div>

      {/* Scrollable body */}
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-7"
      >
        <div className="mx-auto w-full max-w-3xl space-y-6">
          {/* Stem */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-7">
            <QuestionContent
              blocks={stemBlocks}
              onZoom={setZoomedImage}
              showZoomHint
              textClassName="text-[15px] font-medium leading-relaxed text-slate-800 dark:text-slate-100 sm:text-base"
              imageMaxHeight="max-h-[60vh] sm:max-h-96"
            />
          </div>

          {/* Options, accessible radio group */}
          <div>
            <div
              role="radiogroup"
              aria-label="Answer options"
              className="space-y-2.5"
            >
              {options.map((option, i) => {
                const isSelected = selectedOption === option.key;
                return (
                  <div
                    key={option.key}
                    ref={(el) => {
                      optionRefs.current[i] = el;
                    }}
                    role="radio"
                    aria-checked={isSelected}
                    tabIndex={isSelected || (!selectedOption && i === 0) ? 0 : -1}
                    onKeyDown={(e) => onOptionKeyDown(e, i)}
                    onClick={() => selectOption(currentQuestion.id, option.key)}
                    className={`group flex w-full cursor-pointer items-center gap-3.5 rounded-xl border p-3.5 text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50 dark:focus-visible:ring-offset-slate-950 sm:gap-4 sm:p-4 ${
                      isSelected
                        ? "border-indigo-500 bg-indigo-50/70 ring-1 ring-indigo-500/30 dark:border-indigo-400 dark:bg-indigo-500/10"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700 dark:hover:bg-slate-800/50"
                    }`}
                  >
                    <span
                      className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border text-xs font-bold transition-colors ${
                        isSelected
                          ? "border-indigo-500 bg-indigo-500 text-white dark:border-indigo-400 dark:bg-indigo-400 dark:text-slate-900"
                          : "border-slate-300 text-slate-500 group-hover:border-slate-400 dark:border-slate-600 dark:text-slate-400"
                      }`}
                    >
                      {option.key}
                    </span>
                    <span className="min-w-0 flex-1 text-[15px] leading-relaxed text-slate-800 dark:text-slate-100">
                      {option.isImage ? (
                        <QuestionContent
                          blocks={option.blocks}
                          onZoom={setZoomedImage}
                          imageMaxHeight="max-h-[34vh] sm:max-h-52"
                        />
                      ) : (
                        <QuestionContent
                          blocks={option.blocks}
                          textClassName="text-[15px] leading-relaxed"
                        />
                      )}
                    </span>
                    {/* Selected tick — unambiguous, premium confirmation */}
                    <Check
                      className={`h-4 w-4 flex-shrink-0 text-indigo-500 transition-opacity dark:text-indigo-400 ${
                        isSelected ? "opacity-100" : "opacity-0"
                      }`}
                    />
                  </div>
                );
              })}
            </div>

            {/* Keyboard hint */}
            <p className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500">
              <Keyboard className="h-3.5 w-3.5" />
              <span>
                <kbd className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-sans text-[10px] font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">A–{String.fromCharCode(64 + Math.max(1, options.length))}</kbd> select ·{" "}
                <kbd className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-sans text-[10px] font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">Enter</kbd> save &amp; next ·{" "}
                <kbd className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-sans text-[10px] font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">M</kbd> mark ·{" "}
                <kbd className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-sans text-[10px] font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">←/→</kbd> navigate
              </span>
            </p>
          </div>

          {/* Optional study aids: Trick to Higher Scores + Virtual Mentor.
              Off by default (not part of the authentic CBT); opt-in via the
              settings menu. */}
          {aids.insights && (
            <div className="space-y-3 pt-1">
              <TrickPanel tricks={tricks} />
              <MentorPanel />
            </div>
          )}
        </div>
      </div>

      {/* Action bar */}
      <div className="flex flex-col gap-2.5 border-t border-slate-200 bg-white/90 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/90 sm:px-6">
        {/* Confidence capture — off by default (not part of the authentic CBT).
            Opt-in via the settings menu; when on it feeds the MarksenseAI. */}
        {aids.confidence && (
          <ConfidenceControl
            value={confidence}
            onChange={(c) => setConfidence(currentQuestion.id, c)}
          />
        )}

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="grid grid-cols-3 gap-2 sm:flex sm:items-center">
            <ActionButton
              onClick={() => currentQuestionIndex > secStart && setQuestionIndex(currentQuestionIndex - 1)}
              disabled={currentQuestionIndex <= secStart}
              variant="ghost"
            >
              <ChevronLeft className="h-4 w-4" />
              <span>Prev</span>
            </ActionButton>
            <ActionButton
              onClick={() => markForReviewAndNext(currentQuestion.id)}
              variant={isMarked ? "violet-active" : "ghost"}
            >
              <Flag className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Mark &amp; Next</span>
              <span className="sm:hidden">Mark</span>
            </ActionButton>
            <ActionButton onClick={() => clearResponse(currentQuestion.id)} variant="ghost">
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Clear</span>
            </ActionButton>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <ActionButton
              onClick={() => saveAndNext(currentQuestion.id)}
              variant="primary"
              className="w-full sm:w-auto"
            >
              <span>Save &amp; Next</span>
              <ChevronRight className="h-4 w-4" />
            </ActionButton>
            <ActionButton
              onClick={() => setConfirmLock(true)}
              variant="ghost"
              className="w-full sm:w-auto"
            >
              <Lock className="h-3.5 w-3.5" />
              <span>{isLastSection ? "Submit test" : "Submit section"}</span>
            </ActionButton>
          </div>
        </div>
      </div>

      {/* Confirm early section lock (forfeits remaining time, no going back). */}
      {confirmLock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-50">
              {isLastSection ? "Submit the test?" : `Lock ${activeSection?.name || "this section"} and move on?`}
            </h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              {isLastSection
                ? "This ends your test and submits all sections for scoring. You cannot return."
                : "The remaining time in this section is forfeited, not carried forward, and you cannot return to it, exactly like the real exam."}
            </p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setConfirmLock(false)}
                className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Keep working
              </button>
              <button
                onClick={() => { setConfirmLock(false); lockCurrentSection(); }}
                className="flex-1 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500"
              >
                {isLastSection ? "Submit test" : "Lock & continue"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------

const CONFIDENCE_OPTIONS: { value: Confidence; label: string; active: string }[] = [
  { value: "guessed", label: "Guessing", active: "border-rose-300 bg-rose-50 text-rose-600 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-300" },
  { value: "unsure", label: "Unsure", active: "border-amber-300 bg-amber-50 text-amber-600 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300" },
  { value: "confident", label: "Confident", active: "border-emerald-300 bg-emerald-50 text-emerald-600 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300" },
];

/**
 * Compact 3-way confidence control shown near Save (§4). Defaults to "Unsure",
 * never blocks flow, and is the single most important input for the MarksenseAI.
 */
const ConfidenceControl: React.FC<{
  value: Confidence;
  onChange: (c: Confidence) => void;
}> = ({ value, onChange }) => (
  <div className="flex items-center gap-2">
    <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
      Confidence
    </span>
    <div className="flex flex-1 items-center gap-1.5 sm:flex-none" role="radiogroup" aria-label="Answer confidence">
      {CONFIDENCE_OPTIONS.map((opt) => {
        const isActive = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => onChange(opt.value)}
            className={`flex-1 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-all sm:flex-none ${
              isActive
                ? opt.active
                : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400 dark:hover:bg-slate-800"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  </div>
);

/**
 * In-exam settings menu for the optional study aids. A single gear button opens
 * a small popover of switches; everything is off by default so the exam screen
 * is the authentic CBT until a candidate deliberately opts in.
 */
const AID_ROWS: { key: keyof StudyAids; label: string; hint: string }[] = [
  { key: "confidence", label: "Confidence capture", hint: "Rate how sure you were, feeds your MarksenseAI report" },
  { key: "timer", label: "Per-question timer", hint: "Show seconds spent on the current question" },
  { key: "insights", label: "Tips & mentor panels", hint: "In-exam hints and mentor notes" },
];

const StudyAidsMenu: React.FC<{
  open: boolean;
  setOpen: (v: boolean) => void;
  aids: StudyAids;
  toggleAid: (k: keyof StudyAids) => void;
}> = ({ open, setOpen, aids, toggleAid }) => (
  <div className="relative">
    <button
      type="button"
      onClick={() => setOpen(!open)}
      aria-haspopup="true"
      aria-expanded={open}
      aria-label="Exam view settings"
      className={`flex h-7 w-7 items-center justify-center rounded-lg border transition ${
        open
          ? "border-indigo-300 bg-indigo-50 text-indigo-600 dark:border-indigo-500/40 dark:bg-indigo-500/10 dark:text-indigo-300"
          : "border-slate-200 text-slate-400 hover:text-slate-600 dark:border-slate-700 dark:hover:text-slate-200"
      }`}
    >
      <SlidersHorizontal className="h-4 w-4" />
    </button>

    {open && (
      <>
        {/* click-away backdrop */}
        <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
        <div
          role="menu"
          className="absolute right-0 top-9 z-50 w-72 rounded-xl border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-700 dark:bg-slate-900"
        >
          <p className="px-1 pb-2 text-[11px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
            Study aids, off for a real exam feel
          </p>
          <div className="space-y-1">
            {AID_ROWS.map((row) => {
              const on = aids[row.key];
              return (
                <button
                  key={row.key}
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={on}
                  onClick={() => toggleAid(row.key)}
                  className="flex w-full items-start gap-3 rounded-lg px-2 py-2 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/60"
                >
                  <span
                    className={`mt-0.5 flex h-5 w-9 flex-shrink-0 items-center rounded-full p-0.5 transition-colors ${
                      on ? "bg-indigo-500 justify-end" : "bg-slate-300 justify-start dark:bg-slate-600"
                    }`}
                  >
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white text-indigo-600 shadow-sm">
                      {on && <Check className="h-3 w-3" />}
                    </span>
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-slate-800 dark:text-slate-100">{row.label}</span>
                    <span className="block text-[11px] leading-snug text-slate-400 dark:text-slate-500">{row.hint}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </>
    )}
  </div>
);

interface ActionButtonProps {
  onClick: () => void;
  disabled?: boolean;
  variant: "primary" | "ghost" | "violet-active";
  className?: string;
  children: React.ReactNode;
}

const ActionButton: React.FC<ActionButtonProps> = ({
  onClick,
  disabled,
  variant,
  className = "",
  children,
}) => {
  const base =
    "flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl px-4 text-sm font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900 disabled:cursor-not-allowed disabled:opacity-40";
  const variants: Record<ActionButtonProps["variant"], string> = {
    primary:
      "bg-indigo-600 text-white shadow-sm hover:bg-indigo-500 active:scale-[0.98]",
    ghost:
      "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200 dark:hover:bg-slate-800",
    "violet-active":
      "border border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-500/40 dark:bg-violet-500/10 dark:text-violet-300",
  };
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={`${base} ${variants[variant]} ${className}`}>
      {children}
    </button>
  );
};
