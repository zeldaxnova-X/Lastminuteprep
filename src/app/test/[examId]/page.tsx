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
      router.push(`/test/${examId}/result`);
    }
  }, [isSubmitted, examId, router]);

  // Handle ESC key to close mobile drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isMobileDrawerOpen) {
        setIsMobileDrawerOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMobileDrawerOpen]);

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
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-white text-gray-700 gap-3 font-sans">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <span className="text-sm font-bold tracking-wide uppercase">Initializing Staff Selection Commission CBT Portal...</span>
      </div>
    );
  }

  if (error || validatedQuestions.length === 0) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-white text-gray-700 gap-4 font-sans p-4 text-center">
        <p className="text-sm font-bold text-red-600">{error || "No questions found for this test."}</p>
        <button
          onClick={() => router.push("/dashboard")}
          className="px-5 py-2.5 rounded-lg bg-blue-600 text-white font-bold text-xs"
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
    <div className="h-screen w-screen flex flex-col bg-white text-gray-900 overflow-hidden font-sans select-none antialiased relative">
      <CBTHeader title={title} totalQuestions={validatedQuestions.length} />

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        <CBTQuestionView
          sections={sections}
          currentQuestion={currentQuestion}
          questions={validatedQuestions}
          totalQuestions={validatedQuestions.length}
        />

        {/* Desktop & Tablet Sidebar Palette (≥768px) */}
        <div className="hidden md:flex w-72 lg:w-80 h-full flex-shrink-0">
          <CBTPalette
            questions={validatedQuestions}
            onSubmitClick={() => setIsSubmitModalOpen(true)}
          />
        </div>
      </div>

      {/* Mobile Floating Question Palette Trigger Button (<768px) — Positioned elevated above action bar */}
      <button
        onClick={() => setIsMobileDrawerOpen((prev) => !prev)}
        className="md:hidden fixed bottom-24 right-4 z-40 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold px-3.5 py-2.5 rounded-full shadow-xl border-2 border-white flex items-center gap-2 text-xs transition-all min-h-[44px]"
        aria-label="Toggle Question Palette Drawer"
        aria-expanded={isMobileDrawerOpen}
      >
        <LayoutGrid className="w-4 h-4" />
        <span>Palette ({currentQuestionIndex + 1}/{validatedQuestions.length})</span>
      </button>

      {/* Mobile Slide-Out Navigation Drawer (<768px) */}
      {isMobileDrawerOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Question Palette">
          {/* Backdrop Overlay */}
          <div
            className="fixed inset-0 bg-gray-900/60 backdrop-blur-xs transition-opacity duration-300"
            onClick={() => setIsMobileDrawerOpen(false)}
          />

          {/* Slide-out Drawer Panel */}
          <div className="relative w-80 max-w-[85vw] h-full bg-white shadow-2xl z-10 flex flex-col transition-transform duration-300 transform translate-x-0">
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

      {/* Submit Confirmation Modal */}
      {isSubmitModalOpen && (
        <CBTSubmitModal
          questions={validatedQuestions}
          onClose={() => setIsSubmitModalOpen(false)}
          onConfirmSubmit={handleConfirmSubmit}
        />
      )}

      {/* Click-to-Zoom Image Modal */}
      {zoomedImage && (
        <div className="fixed inset-0 z-50 bg-gray-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="relative max-w-4xl max-h-[90vh] bg-white border border-gray-300 rounded-2xl p-4 shadow-xl overflow-hidden flex flex-col items-center">
            <button
              onClick={() => setZoomedImage(null)}
              className="absolute top-3 right-3 bg-gray-100 hover:bg-gray-200 text-gray-700 p-2 rounded-full transition-colors z-10"
            >
              <X className="w-5 h-5" />
            </button>
            <img src={zoomedImage} alt="Zoomed view" className="max-h-[80vh] w-auto object-contain rounded-lg" />
          </div>
        </div>
      )}
    </div>
  );
}
