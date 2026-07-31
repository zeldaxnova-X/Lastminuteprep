// ============================================================
// LastMilePrep — Timeline Analyzer Module
// Pure array generator for Recharts (Accuracy, Speed, Score, Momentum)
// ============================================================

import type { ExamAttemptInput, Timelines, TimelineDataPoint, SectionMomentumData } from "./types";
import type { Subject } from "@/types/database.types";

export function analyzeTimelines(attempt: ExamAttemptInput): Timelines {
  let cumulativeScore = 0;
  const dataPoints: TimelineDataPoint[] = [];
  const accuracyTimeline: number[] = [];
  const speedTimeline: number[] = [];
  const rollingScoreTimeline: number[] = [];
  const momentumTimeline: number[] = [];

  attempt.answers.forEach((ans, i) => {
    const timeSpent = ans.time_spent_seconds || 0;
    const marks = ans.marks_awarded || 0;
    cumulativeScore += marks;

    // Rolling 10-question window accuracy
    const windowSlice = attempt.answers.slice(Math.max(0, i - 9), i + 1);
    const windowAttempted = windowSlice.filter((x) => x.selected_option !== null);
    const windowCorrect = windowAttempted.filter((x) => x.is_correct === true).length;
    const rollingAcc = windowAttempted.length > 0 ? Math.round((windowCorrect / windowAttempted.length) * 100) : 0;

    // Momentum score: combination of rolling accuracy and pacing efficiency
    const momentum = Math.max(10, Math.min(100, Math.round(rollingAcc * 0.8 + (timeSpent <= 40 ? 20 : 0))));

    const qNum = ans.question.question_number || i + 1;
    const dp: TimelineDataPoint = {
      index: i + 1,
      question_number: qNum,
      subject: ans.question.subject,
      rolling_accuracy: rollingAcc,
      speed_seconds: timeSpent,
      cumulative_score: Math.round(cumulativeScore * 10) / 10,
      momentum_score: momentum,
    };

    dataPoints.push(dp);
    accuracyTimeline.push(rollingAcc);
    speedTimeline.push(timeSpent);
    rollingScoreTimeline.push(dp.cumulative_score);
    momentumTimeline.push(momentum);
  });

  // Section Momentum (First half vs Second half per subject)
  const subjects: Subject[] = [
    "General Intelligence & Reasoning",
    "General Awareness",
    "Quantitative Aptitude",
    "English Comprehension",
  ];

  const sectionMomentum: SectionMomentumData[] = subjects.map((subj) => {
    const subjAnswers = attempt.answers.filter((a) => a.question.subject === subj);
    if (subjAnswers.length === 0) {
      return { subject: subj, first_half_accuracy: 0, second_half_accuracy: 0, momentum_trend: "stable" };
    }

    const half = Math.floor(subjAnswers.length / 2);
    const firstHalf = subjAnswers.slice(0, half);
    const secondHalf = subjAnswers.slice(half);

    const fAttempted = firstHalf.filter((a) => a.selected_option !== null);
    const fCorrect = fAttempted.filter((a) => a.is_correct === true).length;
    const fAcc = fAttempted.length > 0 ? Math.round((fCorrect / fAttempted.length) * 100) : 0;

    const sAttempted = secondHalf.filter((a) => a.selected_option !== null);
    const sCorrect = sAttempted.filter((a) => a.is_correct === true).length;
    const sAcc = sAttempted.length > 0 ? Math.round((sCorrect / sAttempted.length) * 100) : 0;

    let trend: "improving" | "stable" | "declining" = "stable";
    if (sAcc > fAcc + 8) trend = "improving";
    else if (fAcc > sAcc + 8) trend = "declining";

    return {
      subject: subj,
      first_half_accuracy: fAcc,
      second_half_accuracy: sAcc,
      momentum_trend: trend,
    };
  });

  return {
    accuracy_timeline: accuracyTimeline,
    speed_timeline: speedTimeline,
    rolling_score_timeline: rollingScoreTimeline,
    momentum_timeline: momentumTimeline,
    section_momentum: sectionMomentum,
    data_points: dataPoints,
  };
}
