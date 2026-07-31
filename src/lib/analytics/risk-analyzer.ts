// ============================================================
// LastMilePrep — Risk Analyzer Module
// Pure calculation of negative mark leakage, rapid guesses, and risk discipline
// ============================================================

import type { ExamAttemptInput, RiskSummary } from "./types";

export function analyzeRisk(attempt: ExamAttemptInput): RiskSummary {
  const negMarksPerQ = attempt.negative_marks_per_question || 0.5;

  let blindGuesses = 0;
  let educatedGuesses = 0;
  let highConfidence = 0;
  let rapidWrong = 0;
  let wrongCount = 0;

  attempt.answers.forEach((ans) => {
    const timeSpent = ans.time_spent_seconds || 0;
    const changes = ans.answer_change_count || 0;

    if (ans.selected_option !== null) {
      if (ans.is_correct === false) {
        wrongCount++;
        if (timeSpent <= 8) {
          blindGuesses++;
          rapidWrong++;
        } else {
          educatedGuesses++;
        }
      } else {
        if (timeSpent <= 35 && changes === 0 && !ans.is_marked_for_review) {
          highConfidence++;
        } else if (changes > 0) {
          educatedGuesses++;
        }
      }
    }
  });

  const negativeLoss = Math.round(wrongCount * negMarksPerQ * 10) / 10;

  return {
    blind_guesses_count: blindGuesses,
    educated_guesses_count: educatedGuesses,
    high_confidence_count: highConfidence,
    negative_loss: negativeLoss,
    rapid_wrong_count: rapidWrong,
  };
}
