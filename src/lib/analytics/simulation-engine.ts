// ============================================================
// LastMilePrep — Strategy Simulator Engine Module
// Pure replay simulation to compute best possible score & strategy gaps
// ============================================================

import type { ExamAttemptInput, StrategySimulationResult } from "./types";

export function simulateStrategy(attempt: ExamAttemptInput): StrategySimulationResult {
  const marksPerQ = attempt.marks_per_question || 2.0;
  const negMarksPerQ = attempt.negative_marks_per_question || 0.5;

  let actualScore = 0;
  let rapidWrongCount = 0;
  let uncertainWrongCount = 0;
  let unattemptedMarkedCount = 0;

  attempt.answers.forEach((ans) => {
    const timeSpent = ans.time_spent_seconds || 0;
    if (ans.selected_option !== null) {
      if (ans.is_correct === true) {
        actualScore += marksPerQ;
      } else {
        actualScore -= negMarksPerQ;
        if (timeSpent <= 8) rapidWrongCount++;
        if (timeSpent >= 60 || ans.answer_change_count > 1) uncertainWrongCount++;
      }
    } else {
      if (ans.is_marked_for_review) unattemptedMarkedCount++;
    }
  });

  actualScore = Math.max(0, Math.round(actualScore * 10) / 10);

  // If skipped uncertain guesses: save 0.5 penalty per item
  const ifSkippedUncertain = Math.round((actualScore + uncertainWrongCount * negMarksPerQ) * 10) / 10;

  // If avoided rapid guesses: save 0.5 penalty per item
  const ifAvoidedRapidGuesses = Math.round((actualScore + rapidWrongCount * negMarksPerQ) * 10) / 10;

  // If reviewed marked: assume 60% accuracy on unattempted marked
  const ifReviewedMarked = Math.round((actualScore + unattemptedMarkedCount * 0.6 * marksPerQ) * 10) / 10;

  // Best possible score by eliminating rapid guesses + time sink wrong answers
  const potentialRecovery = rapidWrongCount * negMarksPerQ + uncertainWrongCount * negMarksPerQ;
  const maxPossible = attempt.total_questions * marksPerQ;
  const bestPossibleScore = Math.min(maxPossible, Math.round((actualScore + potentialRecovery) * 10) / 10);
  const differenceMarks = Math.max(0, Math.round((bestPossibleScore - actualScore) * 10) / 10);

  return {
    actual_score: actualScore,
    best_possible_score: bestPossibleScore,
    difference_marks: differenceMarks,
    if_skipped_uncertain: ifSkippedUncertain,
    if_avoided_rapid_guesses: ifAvoidedRapidGuesses,
    if_reviewed_marked: ifReviewedMarked,
  };
}
