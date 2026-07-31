"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Zap, Bookmark, Trash2, ArrowRight, ExternalLink, Search, Filter } from "lucide-react";
import { KaTeXRenderer } from "@/components/katex-renderer";

interface BookmarkItem {
  id: string;
  question_id: string;
  question_text: string;
  subject: string;
  paper_name: string;
  created_at: string;
  note?: string;
}

export default function BookmarksPage() {
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSubject, setSelectedSubject] = useState<string>("ALL");

  useEffect(() => {
    async function fetchBookmarks() {
      try {
        const res = await fetch("/api/cbt/bookmarks");
        const json = await res.json();
        if (json.bookmarks) {
          setBookmarks(json.bookmarks);
        } else {
          // Fallback sample bookmarks for illustration
          setBookmarks([
            {
              id: "bm-1",
              question_id: "vq-101",
              question_text: "If $a + b + c = 0$, then find the value of $\\frac{a^2}{bc} + \\frac{b^2}{ca} + \\frac{c^2}{ab}$.",
              subject: "Quantitative Aptitude",
              paper_name: "SSC CGL Tier I 2023 Shift 1",
              created_at: "2026-07-30T10:00:00Z",
              note: "Identity: $a^3 + b^3 + c^3 - 3abc = (a+b+c)(a^2+b^2+c^2-ab-bc-ca)$. Answer is 3.",
            },
            {
              id: "bm-2",
              question_id: "vq-102",
              question_text: "Select the most appropriate synonym of the given word: **APEX**",
              subject: "English Comprehension",
              paper_name: "SSC CGL Tier I 2023 Shift 2",
              created_at: "2026-07-30T11:30:00Z",
              note: "Apex = Pinnacle / Zenith / Acme.",
            },
          ]);
        }
      } catch (e) {
        console.error("Error fetching bookmarks", e);
      } finally {
        setLoading(false);
      }
    }
    fetchBookmarks();
  }, []);

  const handleRemoveBookmark = (id: string) => {
    setBookmarks((prev) => prev.filter((b) => b.id !== id));
  };

  const filtered = bookmarks.filter((b) => {
    const matchSubj = selectedSubject === "ALL" || b.subject === selectedSubject;
    const matchSearch =
      searchQuery.trim() === "" ||
      b.question_text.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (b.note && b.note.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchSubj && matchSearch;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-amber-500 selection:text-slate-950 flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2.5 font-black text-xl tracking-tight text-white">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center">
              <Zap className="w-4 h-4 text-slate-950 fill-slate-950" />
            </div>
            <span>LastMile<span className="text-amber-400">Prep</span></span>
          </Link>
          <Link href="/dashboard" className="text-xs text-slate-400 hover:text-white transition-colors font-semibold">
            ← Back to Dashboard
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 flex-1 space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <Bookmark className="w-7 h-7 text-amber-400 fill-amber-400" />
            <span>Bookmarked Questions Library</span>
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Review tricky questions, personal solution notes, and formulas saved during exam attempts.
          </p>
        </div>

        {/* Filter Controls */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search saved notes or question text..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 rounded-xl pl-10 pr-4 py-2 text-xs sm:text-sm focus:outline-none focus:border-amber-400"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {["ALL", "Quantitative Aptitude", "General Intelligence & Reasoning", "General Awareness", "English Comprehension"].map((subj) => (
              <button
                key={subj}
                onClick={() => setSelectedSubject(subj)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  selectedSubject === subj
                    ? "bg-amber-400 text-slate-950 font-bold"
                    : "bg-slate-950 border border-slate-800 text-slate-400 hover:text-white"
                }`}
              >
                {subj}
              </button>
            ))}
          </div>
        </div>

        {/* Bookmark Cards */}
        {filtered.length === 0 ? (
          <div className="text-center py-16 bg-slate-900 border border-slate-800 rounded-2xl">
            <p className="text-slate-400 font-medium text-sm">No bookmarked questions match your criteria.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((b) => (
              <div
                key={b.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-lg hover:border-slate-700 transition-colors"
              >
                <div className="flex items-center justify-between border-b border-slate-800 pb-3 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="bg-slate-950 border border-slate-800 text-amber-400 font-bold px-2.5 py-1 rounded-md">
                      {b.subject}
                    </span>
                    <span className="text-slate-400">{b.paper_name}</span>
                  </div>

                  <button
                    onClick={() => handleRemoveBookmark(b.id)}
                    className="text-slate-500 hover:text-red-400 transition-colors p-1"
                    title="Remove Bookmark"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="text-sm sm:text-base text-slate-100 font-medium leading-relaxed bg-slate-950 border border-slate-800/80 rounded-xl p-4">
                  <KaTeXRenderer content={b.question_text} />
                </div>

                {b.note && (
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3.5 text-xs text-amber-300 space-y-1">
                    <span className="font-bold uppercase tracking-wider text-[10px] block text-amber-400">
                      Personal Revision Note
                    </span>
                    <KaTeXRenderer content={b.note} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
