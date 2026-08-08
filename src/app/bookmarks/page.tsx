"use client";

import { useState, useEffect, useMemo } from "react";
import { TopNav } from "@/components/top-nav";
import { Card } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { KaTeXRenderer } from "@/components/katex-renderer";
import { sectionLabel } from "@/lib/cbt-questions";
import { cn } from "@/lib/utils";
import { Bookmark, Search, Loader2 } from "lucide-react";

interface BookmarkRow {
  id: string;
  question_id: string;
  note?: string | null;
  created_at: string;
  question: {
    question_text?: string;
    subject?: string;
    paper_name?: string;
  } | null;
}

const SUBJECTS = [
  "ALL",
  "reasoning",
  "general_awareness",
  "quantitative_aptitude",
  "english_comprehension",
];

export default function BookmarksPage() {
  const [bookmarks, setBookmarks] = useState<BookmarkRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [subject, setSubject] = useState("ALL");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/cbt/bookmarks");
        const json = await res.json();
        setBookmarks(Array.isArray(json.bookmarks) ? json.bookmarks : []);
      } catch {
        setBookmarks([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    return bookmarks.filter((b) => {
      const secKey = b.question?.subject ?? "";
      const matchSubj = subject === "ALL" || secKey === subject;
      const text = `${b.question?.question_text ?? ""} ${b.note ?? ""}`.toLowerCase();
      const matchSearch = query.trim() === "" || text.includes(query.toLowerCase());
      return matchSubj && matchSearch;
    });
  }, [bookmarks, query, subject]);

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <TopNav />
      <main className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-4 py-10 sm:px-6">
        <div className="space-y-1.5">
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            <Bookmark className="h-6 w-6 text-accent" />
            Bookmarks
          </h1>
          <p className="text-sm text-ink-secondary">
            Questions you saved during mocks, with your revision notes.
          </p>
        </div>

        {/* Filters */}
        <Card className="space-y-3 p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-tertiary" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search saved questions or notes…"
              className="w-full rounded-lg border border-hairline bg-panel py-2 pl-9 pr-3 text-sm text-ink placeholder:text-ink-tertiary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
            />
          </div>
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
        </Card>

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-ink-secondary">
            <Loader2 className="h-4 w-4 animate-spin text-accent" />
            <span className="text-sm">Loading bookmarks…</span>
          </div>
        ) : filtered.length === 0 ? (
          <Card className="flex flex-col items-center gap-2 px-6 py-16 text-center">
            <Bookmark className="h-6 w-6 text-ink-tertiary" />
            <p className="text-sm font-medium text-ink">
              {bookmarks.length === 0 ? "No bookmarks yet" : "Nothing matches your filters"}
            </p>
            <p className="max-w-sm text-sm text-ink-secondary">
              {bookmarks.length === 0
                ? "Bookmark a question during a mock to save it here for revision."
                : "Try a different subject or search term."}
            </p>
            {bookmarks.length === 0 && (
              <ButtonLink href="/test/create?mode=pyp" variant="secondary" size="sm" className="mt-2">
                Start a mock
              </ButtonLink>
            )}
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map((b) => (
              <Card key={b.id} className="space-y-3 p-5">
                <div className="flex items-center gap-2 text-xs">
                  {b.question?.subject && (
                    <span className="rounded-md bg-accent-soft px-2 py-0.5 font-semibold text-accent">
                      {sectionLabel(b.question.subject)}
                    </span>
                  )}
                  {b.question?.paper_name && (
                    <span className="text-ink-tertiary">{b.question.paper_name}</span>
                  )}
                </div>
                {b.question?.question_text && (
                  <div className="rounded-lg border border-hairline bg-panel p-3.5 text-sm text-ink">
                    <KaTeXRenderer content={b.question.question_text} />
                  </div>
                )}
                {b.note && (
                  <div className="rounded-lg bg-accent-soft p-3 text-xs text-accent">
                    <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider">
                      Your note
                    </span>
                    <KaTeXRenderer content={b.note} />
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
