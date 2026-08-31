"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTestStore } from "@/lib/store/use-test-store";
import { CBTHeader } from "@/components/cbt/cbt-header";
import { CBTQuestionView } from "@/components/cbt/cbt-question-view";
import { CBTPalette } from "@/components/cbt/cbt-palette";
import { CBTSubmitModal } from "@/components/cbt/cbt-submit-modal";
import type { ValidatedQuestion, Subject } from "@/types/database.types";
import { X, Loader2, LayoutGrid } from "lucide-react";

export default function CBTTestEnginePage() {
  const params = useParams();
  const router = useRouter();
  const examId = (params?.examId as string) || "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState<string>("SSC CGL Practice Test");
  const [validatedQuestions, setValidatedQuestions] = useState<ValidatedQuestion[]>([]);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  const { initTest, isSubmitted, currentQuestionIndex, submitTest, zoomedImage, setZoomedImage } = useTestStore();
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [showMobileWarning, setShowMobileWarning] = useState(true);

  useEffect(() => {
    async function loadAttemptData() {
      if (!examId) return;
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/cbt/exams/${examId}`);
        const data = await res.json();

        if (res.ok && data.attempt && data.answers) {
          setTitle(data.attempt.title || "SSC CGL Examination");

          const qList: ValidatedQuestion[] = data.answers
            .map((ans: { question: ValidatedQuestion }) => ans.question)
            .filter(Boolean);

          // CRITICAL DEDUPLICATION CHECK
          const uniqueIds = new Set(qList.map((q) => q.id));
          if (uniqueIds.size !== qList.length) {
            console.error("Duplicate question detected in attempt!");
            setError("Duplicate question detected in attempt. Test session aborted.");
            setLoading(false);
            return;
          }

          setValidatedQuestions(qList);
          initTest(
            data.attempt.id,
            data.attempt.id,
            qList.map((q) => q.id),
            Math.round((data.time_remaining_seconds || data.attempt.time_limit_seconds) / 60)
          );
        } else {
          // Fallback to launch initial paper
          const papersRes = await fetch("/api/cbt/papers");
          const papersJson = await papersRes.json();
          if (papersJson.papers && papersJson.papers.length > 0) {
            const defaultPaperId = papersJson.papers[0].paper_id;
            const qRes = await fetch(`/api/cbt/exams/start`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                exam_type: "previous_year_paper",
                paper_id: defaultPaperId,
              }),
            });
            const qData = await qRes.json();
            if (qRes.ok && qData.questions) {
              setTitle(qData.title);
              setValidatedQuestions(qData.questions);
              initTest(
                qData.attempt_id,
                qData.attempt_id,
                qData.questions.map((q: { id: string }) => q.id),
                Math.round(qData.time_limit_seconds / 60)
              );
            }
          }
        }
      } catch (err: unknown) {
        console.error("Failed to load CBT exam attempt", err);
        setError("Failed to initialize CBT exam software");
      } finally {
        setLoading(false);
      }
    }

    loadAttemptData();
  }, [examId]);

  useEffect(() => {
    if (isSubmitted && examId) {
      // A free sample (?sample=1) routes to the conversion screen; a full
      // attempt routes to the premium report.
      const isSample =
        typeof window !== "undefined" &&
        new URLSearchParams(window.location.search).get("sample") === "1";
      router.push(isSample ? `/sample/${examId}` : `/test/${examId}/result`);
    }
  }, [isSubmitted, examId, router]);

  // Handle ESC key to close the mobile drawer or the zoom modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (zoomedImage) setZoomedImage(null);
      else if (isMobileDrawerOpen) setIsMobileDrawerOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMobileDrawerOpen, zoomedImage, setZoomedImage]);

  // Derive unique sections in actual generated question order
  const sections: Subject[] = useMemo(() => {
    const list: Subject[] = [];
    validatedQuestions.forEach((q) => {
      const s = q.subject || "Quantitative Aptitude";
      if (!list.includes(s)) list.push(s);
    });
    return list.length > 0 ? list : ["General Intelligence & Reasoning", "General Awareness", "Quantitative Aptitude", "English Comprehension"];
  }, [validatedQuestions]);

  if (loading) {
    return (
      <div className="flex h-screen h-[100dvh] w-screen flex-col items-center justify-center gap-3 bg-slate-50 text-slate-600 dark:bg-slate-950 dark:text-slate-300">
        <Loader2 className="h-7 w-7 animate-spin text-indigo-500" />
        <span className="text-sm font-medium tracking-wide text-slate-500 dark:text-slate-400">Preparing your test…</span>
      </div>
    );
  }

  if (error || validatedQuestions.length === 0) {
    return (
      <div className="flex h-screen h-[100dvh] w-screen flex-col items-center justify-center gap-4 bg-slate-50 p-4 text-center dark:bg-slate-950">
        <p className="text-sm font-medium text-rose-600 dark:text-rose-400">{error || "No questions found for this test."}</p>
        <button
          onClick={() => router.push("/dashboard")}
          className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  const currentQuestion = validatedQuestions[currentQuestionIndex] || validatedQuestions[0];

  const handleConfirmSubmit = () => {
    submitTest();
    setIsSubmitModalOpen(false);
    router.push(`/test/${examId}/result`);
  };

  return (
    <div className="relative flex h-screen h-[100dvh] w-screen select-none flex-col overflow-hidden bg-slate-50 text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-100">
      <CBTHeader title={title} totalQuestions={validatedQuestions.length} />

      {/* Mobile advisory, the real TCS iON CBT runs on desktop. This layout is
          faithful but scaled down; warn once, dismissible. (§8) */}
      {showMobileWarning && (
        <div className="flex items-start gap-2 border-b border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300 md:hidden">
          <span className="flex-1 leading-snug">
            The real exam is a desktop computer-based test. This mobile layout is
            faithful but scaled down, for the most realistic practice, use a laptop
            or tablet.
          </span>
          <button
            onClick={() => setShowMobileWarning(false)}
            className="flex-shrink-0 font-semibold underline"
            aria-label="Dismiss desktop advisory"
          >
            Got it
          </button>
        </div>
      )}

      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row">
        <CBTQuestionView
          sections={sections}
          currentQuestion={currentQuestion}
          questions={validatedQuestions}
          totalQuestions={validatedQuestions.length}
        />

        {/* Desktop & tablet sidebar palette (≥768px) */}
        <div className="hidden h-full w-72 flex-shrink-0 md:flex lg:w-80">
          <CBTPalette
            questions={validatedQuestions}
            onSubmitClick={() => setIsSubmitModalOpen(true)}
          />
        </div>
      </div>

      {/* Mobile floating palette trigger (<768px) */}
      <button
        onClick={() => setIsMobileDrawerOpen((prev) => !prev)}
        className="fixed bottom-32 right-4 z-40 flex min-h-[44px] items-center gap-2 rounded-full bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-indigo-600/30 transition-all active:scale-95 hover:bg-indigo-500 md:hidden"
        aria-label="Toggle question palette"
        aria-expanded={isMobileDrawerOpen}
      >
        <LayoutGrid className="h-4 w-4" />
        <span className="tabular-nums">{currentQuestionIndex + 1}/{validatedQuestions.length}</span>
      </button>

      {/* Mobile slide-out drawer (<768px) */}
      {isMobileDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end md:hidden" role="dialog" aria-modal="true" aria-label="Question palette">
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm"
            onClick={() => setIsMobileDrawerOpen(false)}
          />
          <div className="relative z-10 flex h-full w-80 max-w-[85vw] flex-col shadow-2xl">
            <CBTPalette
              questions={validatedQuestions}
              onSubmitClick={() => setIsSubmitModalOpen(true)}
              onSelectQuestion={() => setIsMobileDrawerOpen(false)}
              onCloseDrawer={() => setIsMobileDrawerOpen(false)}
              isDrawer={true}
            />
          </div>
        </div>
      )}

      {/* Submit confirmation modal */}
      {isSubmitModalOpen && (
        <CBTSubmitModal
          questions={validatedQuestions}
          onClose={() => setIsSubmitModalOpen(false)}
          onConfirmSubmit={handleConfirmSubmit}
        />
      )}

      {/* Click-to-zoom image modal */}
      {zoomedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/75 p-4 backdrop-blur-sm"
          onClick={() => setZoomedImage(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Figure preview"
        >
          <div
            className="relative flex max-h-[90vh] max-w-4xl flex-col items-center overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setZoomedImage(null)}
              className="absolute right-3 top-3 z-10 rounded-full bg-slate-100 p-2 text-slate-600 transition hover:bg-slate-200"
              aria-label="Close preview"
            >
              <X className="h-5 w-5" />
            </button>
            <img src={zoomedImage} alt="Figure, enlarged" className="max-h-[80vh] w-auto rounded-lg object-contain" />
          </div>
        </div>
      )}
    </div>
  );
}
