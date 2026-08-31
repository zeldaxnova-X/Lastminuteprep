// ============================================================
// LastMilePrep, Section Analyzer Module
// Pure calculation of per-section performance, marks, accuracy, pace, and ranks
// ============================================================

import type { ExamAttemptInput, SectionMetrics } from "./types";
import type { Subject } from "@/types/database.types";

export function analyzeSections(attempt: ExamAttemptInput): SectionMetrics[] {
  const marksPerQ = attempt.marks_per_question || 2.0;
  const negMarksPerQ = attempt.negative_marks_per_question || 0.5;

  const subjects: Subject[] = [
    "General Intelligence & Reasoning",
    "General Awareness",
    "Quantitative Aptitude",
    "English Comprehension",
  ];

  const map: Record<Subject, {
    total: number; attempted: number; correct: number; incorrect: number; skipped: number; total_time: number;
  }> = {
    "General Intelligence & Reasoning": { total: 0, attempted: 0, correct: 0, incorrect: 0, skipped: 0, total_time: 0 },
    "General Awareness": { total: 0, attempted: 0, correct: 0, incorrect: 0, skipped: 0, total_time: 0 },
    "Quantitative Aptitude": { total: 0, attempted: 0, correct: 0, incorrect: 0, skipped: 0, total_time: 0 },
    "English Comprehension": { total: 0, attempted: 0, correct: 0, incorrect: 0, skipped: 0, total_time: 0 },
  };

  attempt.answers.forEach((ans) => {
    const subj = ans.question.subject || "Quantitative Aptitude";
    if (map[subj]) {
      map[subj].total++;
      map[subj].total_time += ans.time_spent_seconds || 0;

      if (ans.selected_option === null) {
        map[subj].skipped++;
      } else if (ans.is_correct === true) {
        map[subj].attempted++;
        map[subj].correct++;
      } else {
        map[subj].attempted++;
        map[subj].incorrect++;
      }
    }
  });

  const sectionsUnsorted: Omit<SectionMetrics, "rank">[] = subjects.map((subj) => {
    const s = map[subj];
    const posMarks = s.correct * marksPerQ;
    const negMarks = s.incorrect * negMarksPerQ;
    const netScore = Math.max(0, posMarks - negMarks);
    const accuracy = s.attempted > 0 ? Math.round((s.correct / s.attempted) * 10000) / 100 : 0;
    const avgPace = s.total > 0 ? Math.round(s.total_time / s.total) : 0;

    return {
      subject: subj,
      total_questions: s.total,
      attempted: s.attempted,
      correct: s.correct,
      incorrect: s.incorrect,
      skipped: s.skipped,
      positive_marks: Math.round(posMarks * 10) / 10,
      negative_marks: Math.round(negMarks * 10) / 10,
      net_score: Math.round(netScore * 10) / 10,
      accuracy,
      total_time_seconds: s.total_time,
      avg_time_per_question_seconds: avgPace,
    };
  });

  // Rank sections by net score desc
  const sorted = [...sectionsUnsorted].sort((a, b) => b.net_score - a.net_score || b.accuracy - a.accuracy);
  const rankMap = new Map<Subject, number>();
  sorted.forEach((item, idx) => rankMap.set(item.subject, idx + 1));

  return sectionsUnsorted.map((item) => ({
    ...item,
    rank: rankMap.get(item.subject) || 1,
  }));
}
