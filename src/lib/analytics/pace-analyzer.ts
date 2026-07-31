// ============================================================
// LastMilePrep — Pace Analyzer Module
// Pure calculation of timing, pace per question, time sinks, rapid guesses
// ============================================================

import type { ExamAttemptInput, PaceMetrics } from "./types";

export function analyzePace(attempt: ExamAttemptInput): PaceMetrics {
  const totalQuestions = attempt.total_questions || attempt.answers.length || 100;
  const timeLimitSeconds = attempt.time_limit_seconds || 3600;
  const timeUsedSeconds = Math.min(timeLimitSeconds, attempt.time_spent_seconds || 0);
  const timeRemainingSeconds = Math.max(0, timeLimitSeconds - timeUsedSeconds);

  const times = attempt.answers.map((a) => a.time_spent_seconds || 0);
  const attemptedTimes = attempt.answers
    .filter((a) => a.selected_option !== null)
    .map((a) => a.time_spent_seconds || 0);

  const avgPace = totalQuestions > 0 ? Math.round(timeUsedSeconds / totalQuestions) : 0;
  const fastest = attemptedTimes.length > 0 ? Math.min(...attemptedTimes) : 0;
  const slowest = times.length > 0 ? Math.max(...times) : 0;

  const markedAnswers = attempt.answers.filter((a) => a.is_marked_for_review);
  const markedTimes = markedAnswers.map((a) => a.time_spent_seconds || 0);
  const avgReviewTime = markedTimes.length > 0
    ? Math.round(markedTimes.reduce((sum, t) => sum + t, 0) / markedTimes.length)
    : 0;

  // Rapid guess: answered in <= 8 seconds
  const rapidGuesses = attempt.answers.filter((a) => a.selected_option !== null && (a.time_spent_seconds || 0) <= 8);

  // Time sink: spent >= 90s on question resulting in wrong or skipped
  const timeSinks = attempt.answers.filter(
    (a) => (a.time_spent_seconds || 0) >= 90 && a.is_correct !== true
  );
  const totalTimeSinkSeconds = timeSinks.reduce((sum, a) => sum + (a.time_spent_seconds || 0), 0);

  return {
    time_limit_seconds: timeLimitSeconds,
    time_used_seconds: timeUsedSeconds,
    time_remaining_seconds: timeRemainingSeconds,
    avg_pace_per_question_seconds: avgPace,
    fastest_answer_seconds: fastest,
    slowest_answer_seconds: slowest,
    avg_review_time_seconds: avgReviewTime,
    rapid_guess_count: rapidGuesses.length,
    time_sink_count: timeSinks.length,
    total_time_sink_seconds: totalTimeSinkSeconds,
  };
}
