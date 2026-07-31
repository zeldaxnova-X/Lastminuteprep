"use client";

import { useState, useMemo, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { ExamAnalysis, QuestionConfidence } from "@/lib/analytics/types";
import { KaTeXRenderer } from "@/components/katex-renderer";
import { sanitizeQuestionText } from "@/lib/clean-text";
import {
  Zap,
  ArrowLeft,
  Filter,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Sparkles,
  BookOpen,
  Bookmark,
  Flag,
  Check,
  X,
  Clock,
  RefreshCw,
  ZapOff,
  Loader2,
  Brain,
} from "lucide-react";
import type { ValidatedQuestion } from "@/types/database.types";

interface QuestionItem {
  id: string;
  section: string;
  questionNumber: number;
  questionText: string;
  options: { id: string; text: string }[];
  correctOption: string;
  userOption: string | null;
  explanation: string;
  positiveMarks: number;
  negativeMarks: number;
  timeSpent: number;
  answerChanges: number;
  confidence: QuestionConfidence | null;
}

export default function ReviewAnswersPage() {
  const params = useParams();
  const examId = (params?.examId as string) || "";

  const [analysis, setAnalysis] = useState<ExamAnalysis | null>(null);
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"ALL" | "INCORRECT" | "UNATTEMPTED" | "CORRECT">("ALL");
  const [bookmarkedIds, setBookmarkedIds] = useState<Record<string, boolean>>({});
  const [reportingQuestionId, setReportingQuestionId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState<string>("");
  const [reportSuccess, setReportSuccess] = useState<boolean>(false);

  useEffect(() => {
    async function loadReviewData() {
      if (!examId) return;
      setLoading(true);

      try {
        // Fetch single source of truth analysis
        const res = await fetch(`/api/cbt/analysis/${examId}`);
        if (!res.ok) {
          setError("Failed to load attempt analysis");
          return;
        }

        const data: ExamAnalysis = await res.json();
        setAnalysis(data);

        // Fetch detailed question metadata from attempt endpoint
        const examRes = await fetch(`/api/cbt/exams/${examId}`);
        const examData = await examRes.json();

        if (examRes.ok && examData.answers) {
          const confidenceMap = new Map<string, QuestionConfidence>(
            (data.confidence?.questions || []).map((c) => [c.question_id, c])
          );

          const qList: QuestionItem[] = examData.answers.map(
            (ans: { question: ValidatedQuestion; selected_option: string; time_spent_seconds: number; answer_change_count: number }, idx: number) => {
              const q = ans.question;
              return {
                id: q.id,
                section: q.subject || "Quantitative Aptitude",
                questionNumber: idx + 1,
                questionText: q.question_text,
                options: [
                  { id: "A", text: q.option_a || "Option A" },
                  { id: "B", text: q.option_b || "Option B" },
                  { id: "C", text: q.option_c || "Option C" },
                  { id: "D", text: q.option_d || "Option D" },
                ],
                correctOption: q.correct_answer || "A",
                userOption: ans.selected_option || null,
                explanation: q.official_explanation || "Derivation based on official SSC TCS answer key.",
                positiveMarks: q.marks || 2.0,
                negativeMarks: q.negative_marks || 0.5,
                timeSpent: ans.time_spent_seconds || 0,
                answerChanges: ans.answer_change_count || 0,
                confidence: confidenceMap.get(q.id) || null,
              };
            }
          );

          setQuestions(qList);
        }
      } catch (err) {
        console.error("Failed to load review data", err);
        setError("Network error loading review data");
      } finally {
        setLoading(false);
      }
    }

    loadReviewData();
  }, [examId]);

  const toggleBookmark = (qId: string) => {
    setBookmarkedIds((prev) => ({ ...prev, [qId]: !prev[qId] }));
  };

  const handleReportSubmit = () => {
    setReportSuccess(true);
    setTimeout(() => {
      setReportingQuestionId(null);
      setReportSuccess(false);
      setReportReason("");
    }, 1500);
  };

  const filteredQuestions = useMemo(() => {
    return questions.filter((q) => {
      const userPick = q.userOption;
      if (filter === "INCORRECT") {
        return userPick && userPick !== q.correctOption;
      }
      if (filter === "UNATTEMPTED") {
        return !userPick;
      }
      if (filter === "CORRECT") {
        return userPick === q.correctOption;
      }
      return true;
    });
  }, [questions, filter]);

  if (loading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-white text-gray-700 gap-3 font-sans p-4 text-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <span className="text-xs sm:text-sm font-bold tracking-wide uppercase">Loading Solutions from Single Source of Truth Engine...</span>
      </div>
    );
  }

  if (error || !analysis) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-white text-gray-700 gap-4 font-sans p-4 text-center">
        <p className="text-sm text-red-600 font-bold">{error || "Review data unavailable"}</p>
        <Link href="/dashboard" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold">
          Return to Dashboard
        </Link>
      </div>
    );
  }

  const avgPace = analysis.pace.avg_pace_per_question_seconds || 30;

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans flex flex-col antialiased select-none">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2.5 sm:h-14 flex flex-col sm:flex-row items-center justify-between gap-2.5 sm:gap-4">
          <div className="flex items-center gap-3">
            <Link
              href={`/test/${examId}/result`}
              className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
              title="Back to Result Summary"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="flex items-center gap-2 font-bold text-base sm:text-lg tracking-tight text-gray-900">
              <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
                <Zap className="w-3.5 h-3.5 text-white fill-white" />
              </div>
              <span className="truncate">Answer Key & Detailed Solutions</span>
            </div>
          </div>

          {/* Three Post-Exam Flow Breadcrumb Tabs */}
          <div className="flex flex-wrap items-center justify-center gap-1 bg-gray-100 p-1 rounded-xl border border-gray-200 text-xs font-semibold w-full sm:w-auto">
            <Link href={`/test/${examId}/result`} className="px-2.5 sm:px-3 py-1.5 rounded-lg text-gray-600 hover:text-gray-900 text-center flex-1 sm:flex-none">
              Page 1: Score Card
            </Link>
            <Link href={`/test/${examId}/mentor`} className="px-2.5 sm:px-3 py-1.5 rounded-lg text-gray-600 hover:text-gray-900 text-center flex-1 sm:flex-none">
              Page 2: Virtual Mentor
            </Link>
            <span className="bg-white text-blue-600 px-2.5 sm:px-3 py-1.5 rounded-lg shadow-2xs font-bold border border-gray-200 text-center flex-1 sm:flex-none">
              Page 3: Answer Key
            </span>
          </div>
        </div>
      </header>

      {/* Main Review Content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-4 sm:py-6 flex-1 space-y-4 sm:space-y-6 w-full">
        {/* Controls Bar */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 shadow-2xs space-y-3 sm:space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-base sm:text-lg font-bold text-gray-900 tracking-tight flex items-center gap-2">
                <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 flex-shrink-0" />
                <span>Question-by-Question Solution Analysis</span>
              </h1>
              <p className="text-gray-500 text-xs mt-0.5">
                Single source of truth metrics: overall accuracy {analysis.accuracy.overall_accuracy}%, average pace {avgPace}s/Q.
              </p>
            </div>

            <div className="text-xs bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-700 font-medium flex items-center gap-2 self-start sm:self-auto">
              <span>Showing:</span>
              <span className="text-blue-600 font-bold">{filteredQuestions.length} Questions</span>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 pt-2 border-t border-gray-100 no-scrollbar">
            <span className="text-xs font-semibold text-gray-400 flex items-center gap-1 mr-1 flex-shrink-0">
              <Filter className="w-3.5 h-3.5" /> Filter:
            </span>

            <button
              onClick={() => setFilter("ALL")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap min-h-[36px] ${
                filter === "ALL"
                  ? "bg-blue-600 text-white"
                  : "bg-white border border-gray-200 text-gray-600 hover:border-gray-300"
              }`}
            >
              All ({questions.length})
            </button>

            <button
              onClick={() => setFilter("INCORRECT")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap min-h-[36px] ${
                filter === "INCORRECT"
                  ? "bg-red-600 text-white"
                  : "bg-white border border-gray-200 text-red-600 hover:border-gray-300"
              }`}
            >
              Incorrect
            </button>

            <button
              onClick={() => setFilter("UNATTEMPTED")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap min-h-[36px] ${
                filter === "UNATTEMPTED"
                  ? "bg-gray-700 text-white"
                  : "bg-white border border-gray-200 text-gray-500 hover:border-gray-300"
              }`}
            >
              Unattempted
            </button>

            <button
              onClick={() => setFilter("CORRECT")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap min-h-[36px] ${
                filter === "CORRECT"
                  ? "bg-emerald-600 text-white"
                  : "bg-white border border-gray-200 text-emerald-600 hover:border-gray-300"
              }`}
            >
              Correct
            </button>
          </div>
        </div>

        {/* Question Cards */}
        {filteredQuestions.length === 0 ? (
          <div className="text-center py-16 bg-white border border-gray-200 rounded-xl">
            <p className="text-gray-500 font-medium text-sm">No questions match your selected filter.</p>
            <button
              onClick={() => setFilter("ALL")}
              className="mt-2 text-blue-600 hover:underline text-xs font-semibold"
            >
              Show All Questions
            </button>
          </div>
        ) : (
          <div className="space-y-4 sm:space-y-6">
            {filteredQuestions.map((q) => {
              const userPick = q.userOption;
              const isCorrect = userPick === q.correctOption;
              const isUnattempted = !userPick;
              const isBookmarked = !!bookmarkedIds[q.id];
              const timeSpent = q.timeSpent;
              const changes = q.answerChanges;
              const isRapidGuess = timeSpent > 0 && timeSpent <= 8 && !isUnattempted;

              // Telemetry facts note
              let mentorNote = `Pacing: ${timeSpent}s (Average pace: ${avgPace}s/Q). Confidence level: ${q.confidence?.confidence || "medium"}.`;
              if (timeSpent >= 90 && !isCorrect) {
                mentorNote = `Time sink: ${timeSpent}s spent (${timeSpent - avgPace}s above average). Cap at 90s.`;
              } else if (isRapidGuess && !isCorrect) {
                mentorNote = `Rapid wrong guess in ${timeSpent}s resulting in -0.5 negative penalty.`;
              } else if (isCorrect && timeSpent <= 20) {
                mentorNote = `Fast win: Solved in ${timeSpent}s. High confidence response.`;
              }

              return (
                <div
                  key={q.id}
                  className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6 shadow-2xs space-y-4 sm:space-y-5"
                >
                  {/* Card Header */}
                  <div className="flex flex-wrap items-center justify-between border-b border-gray-100 pb-3 gap-2">
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                      <span className="bg-gray-100 text-gray-700 font-semibold px-2 sm:px-2.5 py-0.5 rounded text-[11px] sm:text-xs border border-gray-200">
                        Q{q.questionNumber} • {q.section}
                      </span>

                      {/* Time Spent Badge */}
                      <span className="bg-gray-50 border border-gray-200 text-gray-600 px-2 py-0.5 rounded text-[11px] sm:text-xs font-mono flex items-center gap-1">
                        <Clock className="w-3 h-3 text-gray-400" />
                        <span>{timeSpent}s</span>
                      </span>

                      {/* Rapid Guess Badge */}
                      {isRapidGuess && (
                        <span className="bg-amber-50 border border-amber-200 text-amber-700 px-2 py-0.5 rounded text-[11px] sm:text-xs font-semibold flex items-center gap-1">
                          <ZapOff className="w-3 h-3 text-amber-500" />
                          <span>Rapid (&le;8s)</span>
                        </span>
                      )}

                      {/* Answer Changed Badge */}
                      {changes > 0 && (
                        <span className="bg-blue-50 border border-blue-200 text-blue-700 px-2 py-0.5 rounded text-[11px] sm:text-xs font-semibold flex items-center gap-1">
                          <RefreshCw className="w-3 h-3 text-blue-500" />
                          <span>Changed ({changes}x)</span>
                        </span>
                      )}

                      {/* Bookmark Toggle */}
                      <button
                        onClick={() => toggleBookmark(q.id)}
                        className={`p-1 sm:p-1.5 rounded-lg border transition-colors flex items-center gap-1 text-xs font-medium min-h-[36px] ${
                          isBookmarked
                            ? "bg-amber-50 border-amber-300 text-amber-700"
                            : "bg-white border-gray-200 text-gray-500 hover:text-gray-900"
                        }`}
                      >
                        <Bookmark className={`w-3.5 h-3.5 ${isBookmarked ? "fill-amber-500" : ""}`} />
                        <span className="hidden sm:inline">{isBookmarked ? "Bookmarked" : "Bookmark"}</span>
                      </button>

                      {/* Report Issue */}
                      <button
                        onClick={() => setReportingQuestionId(q.id)}
                        className="p-1 sm:p-1.5 rounded-lg bg-white border border-gray-200 text-gray-500 hover:text-red-600 text-xs font-medium transition-colors flex items-center gap-1 min-h-[36px]"
                        title="Report Issue"
                      >
                        <Flag className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Report</span>
                      </button>
                    </div>

                    <div>
                      {isCorrect && (
                        <span className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] sm:text-xs font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Correct (+{q.positiveMarks.toFixed(1)})
                        </span>
                      )}
                      {!isCorrect && !isUnattempted && (
                        <span className="bg-red-50 border border-red-200 text-red-600 text-[11px] sm:text-xs font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                          <XCircle className="w-3.5 h-3.5" /> Incorrect (-{q.negativeMarks.toFixed(2)})
                        </span>
                      )}
                      {isUnattempted && (
                        <span className="bg-gray-100 text-gray-500 text-[11px] sm:text-xs font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                          <HelpCircle className="w-3.5 h-3.5" /> Unattempted
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Telemetry Fact Banner */}
                  <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-3 flex items-start gap-2 text-xs">
                    <Brain className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-800 font-medium leading-relaxed">{mentorNote}</span>
                  </div>

                  {/* Question Text (Sanitized) */}
                  <div className="text-sm sm:text-base text-gray-900 font-medium leading-relaxed bg-gray-50 border border-gray-200 rounded-xl p-4 sm:p-5">
                    <KaTeXRenderer content={sanitizeQuestionText(q.questionText)} />
                  </div>

                  {/* Options List */}
                  <div className="space-y-2">
                    <p className="text-[11px] sm:text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Option Breakdown:
                    </p>
                    {q.options.map((option) => {
                      const isUserPicked = userPick === option.id;
                      const isOfficialCorrect = q.correctOption === option.id;

                      let containerStyles = "bg-white border-gray-200 text-gray-700";
                      let badge = null;

                      if (isUserPicked && !isOfficialCorrect) {
                        containerStyles = "bg-red-50 border-red-300 text-red-900";
                        badge = (
                          <span className="bg-red-600 text-white text-[10px] sm:text-[11px] font-semibold px-2 py-0.5 rounded flex items-center gap-1 flex-shrink-0">
                            <XCircle className="w-3 h-3" /> Your Answer (Incorrect)
                          </span>
                        );
                      } else if (isUserPicked && isOfficialCorrect) {
                        containerStyles = "bg-emerald-50 border-emerald-300 text-emerald-900";
                        badge = (
                          <span className="bg-emerald-600 text-white text-[10px] sm:text-[11px] font-semibold px-2 py-0.5 rounded flex items-center gap-1 flex-shrink-0">
                            <CheckCircle2 className="w-3 h-3" /> Your Answer (Correct)
                          </span>
                        );
                      } else if (!isUserPicked && isOfficialCorrect) {
                        containerStyles = "bg-emerald-50 border-emerald-300 text-emerald-900";
                        badge = (
                          <span className="bg-emerald-600 text-white text-[10px] sm:text-[11px] font-semibold px-2 py-0.5 rounded flex items-center gap-1 flex-shrink-0">
                            <CheckCircle2 className="w-3 h-3" />
                            {isUnattempted ? "Correct Answer (Unattempted)" : "Correct Answer"}
                          </span>
                        );
                      }

                      return (
                        <div
                          key={option.id}
                          className={`p-3 sm:p-3.5 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 ${containerStyles}`}
                        >
                          <div className="flex items-center gap-2.5 sm:gap-3">
                            <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-gray-100 border border-gray-300 text-gray-600 font-bold text-xs flex items-center justify-center flex-shrink-0">
                              {option.id}
                            </div>
                            <div className="text-xs sm:text-sm font-medium">
                              <KaTeXRenderer content={sanitizeQuestionText(option.text)} />
                            </div>
                          </div>

                          {badge}
                        </div>
                      );
                    })}
                  </div>

                  {/* Official Solution */}
                  <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-3.5 sm:p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-semibold text-blue-700 text-xs uppercase tracking-wider">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Official Solution & Derivation</span>
                      </div>
                    </div>

                    <div className="text-xs sm:text-sm text-gray-800 leading-relaxed pt-1">
                      <KaTeXRenderer content={sanitizeQuestionText(q.explanation)} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Report Modal */}
      {reportingQuestionId && (
        <div className="fixed inset-0 z-50 bg-gray-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-gray-200 rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="font-bold text-gray-900 text-sm sm:text-base flex items-center gap-2">
                <Flag className="w-4 h-4 text-red-500" />
                <span>Report Question Issue</span>
              </h3>
              <button onClick={() => setReportingQuestionId(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            {reportSuccess ? (
              <div className="py-6 text-center text-emerald-600 font-semibold text-sm flex items-center justify-center gap-2">
                <Check className="w-5 h-5" />
                <span>Report submitted successfully. Thank you!</span>
              </div>
            ) : (
              <>
                <p className="text-xs text-gray-600">
                  Describe the issue (e.g. wrong answer key, typo, image issue):
                </p>
                <textarea
                  rows={3}
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  placeholder="Describe the issue..."
                  className="w-full bg-white border border-gray-200 rounded-lg p-3 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => setReportingQuestionId(null)}
                    className="flex-1 py-2.5 rounded-lg border border-gray-200 text-gray-600 font-semibold text-xs hover:bg-gray-50 min-h-[44px]"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleReportSubmit}
                    className="flex-1 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs min-h-[44px]"
                  >
                    Submit Report
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
