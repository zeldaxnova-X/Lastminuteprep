// ============================================================
// LastMilePrep — Review Analyzer Module
// Pure calculation of mark-for-review strategy and option change effectiveness
// ============================================================

import type { ExamAttemptInput, ReviewMetrics } from "./types";

export function analyzeReview(attempt: ExamAttemptInput): ReviewMetrics {
  const marked = attempt.answers.filter((a) => a.is_marked_for_review);
  const revisited = marked.filter((a) => a.selected_option !== null);

  const changedAnswers = attempt.answers.filter((a) => (a.answer_change_count || 0) > 0);

  let improved = 0;
  let worsened = 0;

  changedAnswers.forEach((ans) => {
    if (ans.initial_option && ans.selected_option && ans.selected_option !== ans.initial_option) {
      if (ans.is_correct === true) improved++;
      else worsened++;
    }
  });

  const efficiency = marked.length > 0
    ? Math.round((revisited.length / marked.length) * 100)
    : 100;

  return {
    total_marked: marked.length,
    revisited_count: revisited.length,
    answer_changes_count: changedAnswers.length,
    improved_count: improved,
    worsened_count: worsened,
    review_efficiency_pct: efficiency,
  };
}
