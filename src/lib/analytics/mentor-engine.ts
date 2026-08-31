// ============================================================
// LastMilePrep, Mentor Engine Module
// Returns strictly structured insights (data objects only, ZERO text paragraphs)
// ============================================================

import type { ExamAttemptInput, StructuredInsight } from "./types";
import type { Subject } from "@/types/database.types";

export function generateStructuredInsights(attempt: ExamAttemptInput): StructuredInsight[] {
  const insights: StructuredInsight[] = [];

  const wrongAnswers = attempt.answers.filter((a) => a.selected_option !== null && a.is_correct === false);
  const rapidWrong = wrongAnswers.filter((a) => (a.time_spent_seconds || 0) <= 8);
  const timeSinks = attempt.answers.filter((a) => (a.time_spent_seconds || 0) >= 90 && a.is_correct !== true);

  // 1. Negative Marks Leakage Insight
  if (wrongAnswers.length > 0) {
    const wrongNums = wrongAnswers.map((a) => a.question.question_number || 1);
    const scoreImpact = Math.round(wrongAnswers.length * 0.5 * 10) / 10;

    insights.push({
      type: "NEGATIVE_MARKS",
      severity: wrongAnswers.length >= 5 ? "CRITICAL" : "HIGH",
      affected_questions: wrongNums,
      score_impact: scoreImpact,
      confidence: 0.95,
    });
  }

  // 2. Time Sink Insight
  if (timeSinks.length > 0) {
    const sinkNums = timeSinks.map((a) => a.question.question_number || 1);
    const timeLost = timeSinks.reduce((sum, a) => sum + (a.time_spent_seconds || 0), 0);
    const scoreImpact = Math.round(timeSinks.length * 0.5 * 10) / 10;

    insights.push({
      type: "TIME_SINK",
      severity: timeLost >= 300 ? "CRITICAL" : "HIGH",
      affected_questions: sinkNums,
      score_impact: scoreImpact,
      time_impact_seconds: timeLost,
      confidence: 0.92,
    });
  }

  // 3. Rapid Guess Insight
  if (rapidWrong.length > 0) {
    const rapidNums = rapidWrong.map((a) => a.question.question_number || 1);
    const scoreImpact = Math.round(rapidWrong.length * 0.5 * 10) / 10;

    insights.push({
      type: "RAPID_GUESS",
      severity: "HIGH",
      affected_questions: rapidNums,
      score_impact: scoreImpact,
      confidence: 0.98,
    });
  }

  // 4. Section Order Recommendation Insight
  const subjectAccuracy: Record<Subject, { attempted: number; correct: number }> = {
    "General Intelligence & Reasoning": { attempted: 0, correct: 0 },
    "General Awareness": { attempted: 0, correct: 0 },
    "Quantitative Aptitude": { attempted: 0, correct: 0 },
    "English Comprehension": { attempted: 0, correct: 0 },
  };

  attempt.answers.forEach((ans) => {
    const subj = ans.question.subject || "Quantitative Aptitude";
    if (ans.selected_option !== null && subjectAccuracy[subj]) {
      subjectAccuracy[subj].attempted++;
      if (ans.is_correct === true) subjectAccuracy[subj].correct++;
    }
  });

  const currentOrder: Subject[] = [
    "General Intelligence & Reasoning",
    "General Awareness",
    "Quantitative Aptitude",
    "English Comprehension",
  ];

  const sortedOrder = [...currentOrder].sort((a, b) => {
    const accA = subjectAccuracy[a].attempted > 0 ? subjectAccuracy[a].correct / subjectAccuracy[a].attempted : 0;
    const accB = subjectAccuracy[b].attempted > 0 ? subjectAccuracy[b].correct / subjectAccuracy[b].attempted : 0;
    return accB - accA;
  });

  if (sortedOrder[0] !== currentOrder[0]) {
    insights.push({
      type: "SECTION_ORDER",
      severity: "MEDIUM",
      affected_questions: [],
      score_impact: 3.5,
      confidence: 0.88,
      recommended_order: sortedOrder,
    });
  }

  // 5. Review Efficiency Insight
  const marked = attempt.answers.filter((a) => a.is_marked_for_review);
  const unvisitedMarked = marked.filter((a) => a.selected_option === null);
  if (unvisitedMarked.length > 0) {
    insights.push({
      type: "REVIEW_EFFICIENCY",
      severity: "MEDIUM",
      affected_questions: unvisitedMarked.map((a) => a.question.question_number || 1),
      score_impact: Math.round(unvisitedMarked.length * 1.0 * 10) / 10,
      confidence: 0.85,
    });
  }

  return insights;
}
