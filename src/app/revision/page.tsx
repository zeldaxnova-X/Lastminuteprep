"use client";

import { useState, useEffect, useMemo } from "react";
import { TopNav } from "@/components/top-nav";
import { Card } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { KaTeXRenderer } from "@/components/katex-renderer";
import { sectionLabel } from "@/lib/cbt-questions";
import { cn } from "@/lib/utils";
import { RotateCcw, Loader2 } from "lucide-react";

interface RevisionQuestion {
  id: string;
  subject?: string;
  question_text?: string;
  correct_answer?: string;
  paper_name?: string;
  times_wrong?: number;
}

const SUBJECTS = [
  "ALL",
  "reasoning",
  "general_awareness",
  "quantitative_aptitude",
  "english_comprehension",
];

export default function RevisionQueuePage() {
  const [questions, setQuestions] = useState<RevisionQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [subject, setSubject] = useState("ALL");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/cbt/analytics/revision-queue");
        const json = await res.json();
        setQuestions(Array.isArray(json.questions) ? json.questions : []);
      } catch {
        setQuestions([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(
    () => questions.filter((q) => subject === "ALL" || q.subject === subject),
    [questions, subject]
  );

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <TopNav />
      <main className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-4 py-10 sm:px-6">
        <div className="space-y-1.5">
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            <RotateCcw className="h-6 w-6 text-accent" />
            Revision
          </h1>
          <p className="text-sm text-ink-secondary">
            Questions you&apos;ve missed across your mocks — revise the ones you get
            wrong most first.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {SUBJECTS.map((s) => (
              <button
                key={s}
                onClick={() => setSubject(s)}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-xs font-semibold transition-premium",
                  subject === s
                    ? "border-accent bg-accent-soft text-accent"
                    : "border-hairline text-ink-secondary hover:bg-panel"
                )}
              >
                {s === "ALL" ? "All" : sectionLabel(s)}
              </button>
            ))}
          </div>
          {!loading && (
            <span className="text-xs text-ink-tertiary">
              {filtered.length} to revise
            </span>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-ink-secondary">
            <Loader2 className="h-4 w-4 animate-spin text-accent" />
            <span className="text-sm">Loading your revision queue…</span>
          </div>
        ) : filtered.length === 0 ? (
          <Card className="flex flex-col items-center gap-2 px-6 py-16 text-center">
            <RotateCcw className="h-6 w-6 text-ink-tertiary" />
            <p className="text-sm font-medium text-ink">
              {questions.length === 0 ? "Nothing to revise yet" : "No misses in this section"}
            </p>
            <p className="max-w-sm text-sm text-ink-secondary">
              {questions.length === 0
                ? "Complete a mock — the questions you get wrong will collect here for focused revision."
                : "You haven't missed any questions in this section. Nice."}
            </p>
            {questions.length === 0 && (
              <ButtonLink href="/test/create?mode=pyp" variant="secondary" size="sm" className="mt-2">
                Take a mock
              </ButtonLink>
            )}
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map((q) => (
              <Card key={q.id} className="space-y-3 p-5">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    {q.subject && (
                      <span className="rounded-md bg-accent-soft px-2 py-0.5 font-semibold text-accent">
                        {sectionLabel(q.subject)}
                      </span>
                    )}
                    {q.paper_name && <span className="text-ink-tertiary">{q.paper_name}</span>}
                  </div>
                  {q.times_wrong && q.times_wrong > 1 && (
                    <span className="rounded-md bg-danger-soft px-2 py-0.5 font-semibold text-danger">
                      Missed {q.times_wrong}×
                    </span>
                  )}
                </div>
                {q.question_text && (
                  <div className="rounded-lg border border-hairline bg-panel p-3.5 text-sm text-ink">
                    <KaTeXRenderer content={q.question_text} />
                  </div>
                )}
                {q.correct_answer && (
                  <div className="flex items-center gap-2 rounded-lg bg-success-soft px-3 py-2 text-xs">
                    <span className="font-medium text-ink-secondary">Correct answer</span>
                    <span className="font-semibold text-success">{q.correct_answer}</span>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
