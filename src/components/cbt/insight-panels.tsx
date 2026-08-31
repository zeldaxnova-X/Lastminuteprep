"use client";

import React, { useId, useState } from "react";
import { Sparkles, Lightbulb, ChevronDown, type LucideIcon } from "lucide-react";
import { KaTeXRenderer } from "@/components/katex-renderer";
import { sanitizeQuestionText } from "@/lib/clean-text";

/**
 * Extension points for the question page.
 *
 * `MentorPanel` and `TrickPanel` are deliberately self-contained and driven by
 * simple data contracts (`MentorInsight`, `QuestionTrick[]`). Populate those
 * from the `questions.tricks` column / the mentor engine later and the panels
 * light up with zero page-level changes. Until then they render a calm, honest
 * empty state rather than fake content.
 */

export interface QuestionTrick {
  type:
    | "elimination"
    | "shortcut"
    | "estimation"
    | "pattern"
    | "trap"
    | "memory"
    | "when_to_skip"
    | "psychology";
  title: string;
  body: string;
}

export interface MentorInsight {
  headline: string;
  detail: string;
  tone?: "neutral" | "encouraging" | "caution";
}

// ---------------------------------------------------------------------------

interface InsightPanelProps {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  accent: string; // tailwind text color for the icon, e.g. "text-indigo-500"
  defaultOpen?: boolean;
  children: React.ReactNode;
}

/** A calm, collapsible study-aid card. Keyboard accessible via the header button. */
const InsightPanel: React.FC<InsightPanelProps> = ({
  icon: Icon,
  title,
  subtitle,
  accent,
  defaultOpen = false,
  children,
}) => {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = useId();

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white/70 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/60">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={bodyId}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/50"
      >
        <span className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 ${accent}`}>
          <Icon className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</span>
          <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{subtitle}</span>
        </span>
        <ChevronDown
          className={`h-4 w-4 flex-shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div id={bodyId} className="border-t border-slate-100 px-4 py-3.5 dark:border-slate-800">
          {children}
        </div>
      )}
    </section>
  );
};

// ---------------------------------------------------------------------------

const TRICK_LABELS: Record<QuestionTrick["type"], string> = {
  elimination: "Elimination",
  shortcut: "Shortcut",
  estimation: "Estimation",
  pattern: "Pattern",
  trap: "Common trap",
  memory: "Memory hook",
  when_to_skip: "When to skip",
  psychology: "Exam psychology",
};

export const TrickPanel: React.FC<{ tricks?: QuestionTrick[]; defaultOpen?: boolean }> = ({
  tricks,
  defaultOpen = false,
}) => (
  <InsightPanel
    icon={Lightbulb}
    title="Trick to Higher Scores"
    subtitle={tricks?.length ? `${tricks.length} strategy note${tricks.length > 1 ? "s" : ""}` : "Score-boosting strategy"}
    accent="text-amber-500"
    defaultOpen={defaultOpen}
  >
    {tricks && tricks.length > 0 ? (
      <ul className="space-y-3">
        {tricks.map((t, i) => (
          <li key={i} className="rounded-xl bg-amber-50/60 p-3 dark:bg-amber-500/5">
            <div className="mb-1 inline-flex rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
              {TRICK_LABELS[t.type] ?? t.type}
            </div>
            <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{t.title}</p>
            <div className="mt-0.5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              <KaTeXRenderer content={sanitizeQuestionText(t.body)} />
            </div>
          </li>
        ))}
      </ul>
    ) : (
      <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">
        Strategy notes for this question, fastest method, traps to avoid, and when to skip, will appear here as they’re added.
      </p>
    )}
  </InsightPanel>
);

export const MentorPanel: React.FC<{ insight?: MentorInsight; defaultOpen?: boolean }> = ({
  insight,
  defaultOpen = false,
}) => (
  <InsightPanel
    icon={Sparkles}
    title="Virtual Mentor"
    subtitle={insight ? insight.headline : "Personalised coaching"}
    accent="text-indigo-500"
    defaultOpen={defaultOpen}
  >
    {insight ? (
      <div className="space-y-1">
        <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{insight.headline}</p>
        <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">{insight.detail}</p>
      </div>
    ) : (
      <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">
        Your mentor will weigh in here, pacing on this topic, recurring mistakes to watch, and
        what to practise next, once enough of your attempts are analysed.
      </p>
    )}
  </InsightPanel>
);
