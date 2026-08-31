// ============================================================
// LastMilePrep, Topic Analyzer Module
// Pure metadata-driven topic performance aggregator & weak topic detection
// ============================================================

import type { ExamAttemptInput, TopicAnalysis, TopicMetric } from "./types";
import type { Subject } from "@/types/database.types";

export function analyzeTopics(attempt: ExamAttemptInput): TopicAnalysis {
  const map = new Map<string, {
    topic: string;
    subject: Subject;
    total: number;
    attempted: number;
    correct: number;
    incorrect: number;
    skipped: number;
    total_time: number;
  }>();

  attempt.answers.forEach((ans) => {
    const topic = deriveTopicName(ans.question);
    const subj = ans.question.subject || "Quantitative Aptitude";
    const key = `${subj}::${topic}`;

    if (!map.has(key)) {
      map.set(key, {
        topic,
        subject: subj,
        total: 0,
        attempted: 0,
        correct: 0,
        incorrect: 0,
        skipped: 0,
        total_time: 0,
      });
    }

    const t = map.get(key)!;
    t.total++;
    t.total_time += ans.time_spent_seconds || 0;

    if (ans.selected_option === null) {
      t.skipped++;
    } else if (ans.is_correct === true) {
      t.attempted++;
      t.correct++;
    } else {
      t.attempted++;
      t.incorrect++;
    }
  });

  const topics: TopicMetric[] = Array.from(map.values()).map((t) => {
    const accuracy = t.attempted > 0 ? Math.round((t.correct / t.attempted) * 10000) / 100 : 0;
    const avgTime = t.total > 0 ? Math.round(t.total_time / t.total) : 0;
    return {
      topic: t.topic,
      subject: t.subject,
      total_questions: t.total,
      attempted: t.attempted,
      correct: t.correct,
      incorrect: t.incorrect,
      skipped: t.skipped,
      accuracy,
      avg_time_seconds: avgTime,
    };
  });

  const weak_topics = topics.filter((t) => t.attempted > 0 && t.accuracy < 60);
  const strong_topics = topics.filter((t) => t.attempted > 0 && t.accuracy >= 80);
  const neutral_topics = topics.filter((t) => t.attempted > 0 && t.accuracy >= 60 && t.accuracy < 80);

  return {
    topics,
    weak_topics,
    strong_topics,
    neutral_topics,
  };
}

function deriveTopicName(q: { question_text?: string | null; subject: Subject }): string {
  const text = (q.question_text || "").toLowerCase();
  const subj = q.subject;

  if (subj === "Quantitative Aptitude") {
    if (text.includes("ratio") || text.includes("proportion")) return "Ratio & Proportion";
    if (text.includes("algebra") || text.includes("x +") || text.includes("x^2")) return "Algebra";
    if (text.includes("triangle") || text.includes("circle") || text.includes("angle")) return "Geometry";
    if (text.includes("percent") || text.includes("%")) return "Percentage";
    if (text.includes("profit") || text.includes("loss") || text.includes("discount")) return "Profit & Loss";
    if (text.includes("speed") || text.includes("distance") || text.includes("train")) return "Speed & Distance";
    return "Arithmetic & Mensuration";
  } else if (subj === "General Intelligence & Reasoning") {
    if (text.includes("coding") || text.includes("code")) return "Coding-Decoding";
    if (text.includes("statement") || text.includes("conclusion") || text.includes("syllogism")) return "Syllogism";
    if (text.includes("series") || text.includes("number")) return "Number Series";
    if (text.includes("blood") || text.includes("relation")) return "Blood Relations";
    if (text.includes("mirror") || text.includes("image") || text.includes("pattern")) return "Non-Verbal Reasoning";
    return "Analogy & Classification";
  } else if (subj === "English Comprehension") {
    if (text.includes("synonym") || text.includes("antonym")) return "Vocabulary & Synonyms";
    if (text.includes("cloze") || text.includes("blank")) return "Cloze Test";
    if (text.includes("error") || text.includes("grammatical")) return "Error Spotting";
    if (text.includes("idiom") || text.includes("phrase")) return "Idioms & Phrases";
    return "Reading Comprehension";
  } else {
    if (text.includes("article") || text.includes("constitution") || text.includes("amendment")) return "Polity & Constitution";
    if (text.includes("dynasty") || text.includes("war") || text.includes("king") || text.includes("century")) return "Indian History";
    if (text.includes("river") || text.includes("mountain") || text.includes("capital")) return "Geography";
    if (text.includes("cell") || text.includes("acid") || text.includes("force") || text.includes("element")) return "General Science";
    return "Static GK & Current Affairs";
  }
}
