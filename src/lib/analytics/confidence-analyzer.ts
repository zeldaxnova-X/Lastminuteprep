// ============================================================
// LastMilePrep, Confidence Analyzer Module
// Pure rule-based calculation of per-question and overall confidence
// ============================================================

import type { ExamAttemptInput, OverallConfidence, QuestionConfidence, ConfidenceLevel } from "./types";

export function analyzeConfidence(attempt: ExamAttemptInput): OverallConfidence {
  const times = attempt.answers.map((a) => a.time_spent_seconds || 0);
  const avgTime = times.length > 0 ? times.reduce((s, t) => s + t, 0) / times.length : 30;

  let highCount = 0;
  let mediumCount = 0;
  let lowCount = 0;

  const questions: QuestionConfidence[] = attempt.answers.map((ans, idx) => {
    const timeSpent = ans.time_spent_seconds || 0;
    const changes = ans.answer_change_count || 0;
    const marked = ans.is_marked_for_review || false;

    // Calculate hesitation factor (0 to 1)
    let hesitation = 0;
    if (timeSpent > avgTime * 1.5) hesitation += 0.4;
    if (changes > 0) hesitation += 0.3 * Math.min(3, changes);
    if (marked) hesitation += 0.3;
    hesitation = Math.min(1.0, Math.max(0, hesitation));

    let confidence: ConfidenceLevel = "medium";
    if (ans.selected_option !== null) {
      if (timeSpent <= Math.max(25, avgTime * 0.8) && changes === 0 && !marked) {
        confidence = "high";
        highCount++;
      } else if (timeSpent >= Math.max(75, avgTime * 2.2) || changes >= 2 || (timeSpent <= 8 && ans.is_correct !== true)) {
        confidence = "low";
        lowCount++;
      } else {
        confidence = "medium";
        mediumCount++;
      }
    } else {
      if (timeSpent >= 60) {
        confidence = "low";
        lowCount++;
      } else {
        confidence = "medium";
        mediumCount++;
      }
    }

    return {
      question_id: ans.question.id,
      question_number: ans.question.question_number || idx + 1,
      subject: ans.question.subject,
      confidence,
      time_spent_seconds: timeSpent,
      answer_change_count: changes,
      is_marked_for_review: marked,
      hesitation_factor: Math.round(hesitation * 100) / 100,
    };
  });

  return {
    high_count: highCount,
    medium_count: mediumCount,
    low_count: lowCount,
    confidence_distribution: {
      high: highCount,
      medium: mediumCount,
      low: lowCount,
    },
    questions,
  };
}
