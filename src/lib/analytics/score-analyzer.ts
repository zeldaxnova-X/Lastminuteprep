// ============================================================
// LastMilePrep — Score Analyzer Module
// Pure calculation of score, marks, percentages, percentile ranks
// ============================================================

import type { ExamAttemptInput, ScoreMetrics, MarksMetrics, AccuracyMetrics } from "./types";

export function analyzeScore(attempt: ExamAttemptInput): {
  score: ScoreMetrics;
  marks: MarksMetrics;
  accuracy: AccuracyMetrics;
} {
  const totalQuestions = attempt.total_questions || attempt.answers.length || 100;
  const marksPerQ = attempt.marks_per_question || 2.0;
  const negMarksPerQ = attempt.negative_marks_per_question || 0.5;
  const maxScore = attempt.max_score || totalQuestions * marksPerQ;

  let correctCount = 0;
  let incorrectCount = 0;
  let skippedCount = 0;

  attempt.answers.forEach((ans) => {
    if (ans.selected_option === null) {
      skippedCount++;
    } else if (ans.is_correct === true) {
      correctCount++;
    } else {
      incorrectCount++;
    }
  });

  const positiveMarks = correctCount * marksPerQ;
  const negativeMarks = incorrectCount * negMarksPerQ;
  const netScore = Math.max(0, positiveMarks - negativeMarks);
  const percentage = maxScore > 0 ? Math.round((netScore / maxScore) * 10000) / 100 : 0;

  const attemptedCount = correctCount + incorrectCount;
  const overallAccuracy = attemptedCount > 0 ? Math.round((correctCount / attemptedCount) * 10000) / 100 : 0;
  const attemptRate = totalQuestions > 0 ? Math.round((attemptedCount / totalQuestions) * 10000) / 100 : 0;

  let percentileRank = "Top 18%";
  let qualificationStatus = "Qualified (Projected)";

  if (netScore >= 160) {
    percentileRank = "Top 2%";
    qualificationStatus = "Qualified (High Rank)";
  } else if (netScore >= 140) {
    percentileRank = "Top 10%";
    qualificationStatus = "Qualified (Projected)";
  } else if (netScore < 110) {
    percentileRank = "Top 45%";
    qualificationStatus = "Below Cutoff Threshold";
  }

  const score: ScoreMetrics = {
    total_score: Math.round(netScore * 10) / 10,
    max_score: maxScore,
    percentage,
    percentile_rank: percentileRank,
    qualification_status: qualificationStatus,
  };

  const marks: MarksMetrics = {
    positive_marks: Math.round(positiveMarks * 10) / 10,
    negative_marks: Math.round(negativeMarks * 10) / 10,
    net_marks: Math.round(netScore * 10) / 10,
    max_marks: maxScore,
  };

  const accuracy: AccuracyMetrics = {
    overall_accuracy: overallAccuracy,
    total_questions: totalQuestions,
    correct_count: correctCount,
    incorrect_count: incorrectCount,
    skipped_count: skippedCount,
    attempted_count: attemptedCount,
    attempt_rate: attemptRate,
  };

  return { score, marks, accuracy };
}
