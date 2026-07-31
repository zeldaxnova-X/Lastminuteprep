// ============================================================
// LastMilePrep — Sprint 2A Telemetry Engine Types
// Single source of truth interfaces for post-exam telemetry & analysis
// ============================================================

import type { ValidatedQuestion, Subject, CorrectAnswer } from "@/types/database.types";

export interface QuestionAttemptInput {
  question: ValidatedQuestion;
  question_index: number;
  selected_option: CorrectAnswer | null;
  is_correct: boolean | null;
  marks_awarded: number;
  time_spent_seconds: number;
  is_marked_for_review: boolean;
  is_visited: boolean;
  answer_change_count: number;
  initial_option: CorrectAnswer | null;
}

export interface ExamAttemptInput {
  id: string;
  user_id: string;
  exam_type: string;
  paper_id: string | null;
  title: string;
  total_questions: number;
  time_limit_seconds: number;
  time_spent_seconds: number;
  marks_per_question: number;
  negative_marks_per_question: number;
  max_score: number;
  status: string;
  created_at: string;
  answers: QuestionAttemptInput[];
}

export interface ScoreMetrics {
  total_score: number;
  max_score: number;
  percentage: number;
  percentile_rank: string;
  qualification_status: string;
}

export interface MarksMetrics {
  positive_marks: number;
  negative_marks: number;
  net_marks: number;
  max_marks: number;
}

export interface AccuracyMetrics {
  overall_accuracy: number;
  total_questions: number;
  correct_count: number;
  incorrect_count: number;
  skipped_count: number;
  attempted_count: number;
  attempt_rate: number;
}

export interface SectionMetrics {
  subject: Subject;
  total_questions: number;
  attempted: number;
  correct: number;
  incorrect: number;
  skipped: number;
  positive_marks: number;
  negative_marks: number;
  net_score: number;
  accuracy: number;
  total_time_seconds: number;
  avg_time_per_question_seconds: number;
  rank: number;
}

export interface PaceMetrics {
  time_limit_seconds: number;
  time_used_seconds: number;
  time_remaining_seconds: number;
  avg_pace_per_question_seconds: number;
  fastest_answer_seconds: number;
  slowest_answer_seconds: number;
  avg_review_time_seconds: number;
  rapid_guess_count: number;
  time_sink_count: number;
  total_time_sink_seconds: number;
}

export type ConfidenceLevel = "high" | "medium" | "low";

export interface QuestionConfidence {
  question_id: string;
  question_number: number;
  subject: Subject;
  confidence: ConfidenceLevel;
  time_spent_seconds: number;
  answer_change_count: number;
  is_marked_for_review: boolean;
  hesitation_factor: number; // 0 to 1
}

export interface OverallConfidence {
  high_count: number;
  medium_count: number;
  low_count: number;
  confidence_distribution: Record<ConfidenceLevel, number>;
  questions: QuestionConfidence[];
}

export interface TimelineDataPoint {
  index: number;
  question_number: number;
  subject: Subject;
  rolling_accuracy: number; // rolling 10-question window
  speed_seconds: number;
  cumulative_score: number;
  momentum_score: number;
}

export interface SectionMomentumData {
  subject: Subject;
  first_half_accuracy: number;
  second_half_accuracy: number;
  momentum_trend: "improving" | "stable" | "declining";
}

export interface Timelines {
  accuracy_timeline: number[];
  speed_timeline: number[];
  rolling_score_timeline: number[];
  momentum_timeline: number[];
  section_momentum: SectionMomentumData[];
  data_points: TimelineDataPoint[];
}

export interface TopicMetric {
  topic: string;
  subject: Subject;
  total_questions: number;
  attempted: number;
  correct: number;
  incorrect: number;
  skipped: number;
  accuracy: number;
  avg_time_seconds: number;
}

export interface TopicAnalysis {
  topics: TopicMetric[];
  weak_topics: TopicMetric[];
  strong_topics: TopicMetric[];
  neutral_topics: TopicMetric[];
}

export interface RiskSummary {
  blind_guesses_count: number;
  educated_guesses_count: number;
  high_confidence_count: number;
  negative_loss: number;
  rapid_wrong_count: number;
}

export interface ReviewMetrics {
  total_marked: number;
  revisited_count: number;
  answer_changes_count: number;
  improved_count: number; // wrong -> correct
  worsened_count: number; // correct -> wrong
  review_efficiency_pct: number;
}

export interface StrategySimulationResult {
  actual_score: number;
  best_possible_score: number;
  difference_marks: number;
  if_skipped_uncertain: number;
  if_avoided_rapid_guesses: number;
  if_reviewed_marked: number;
}

export interface StructuredInsight {
  type: "NEGATIVE_MARKS" | "TIME_SINK" | "RAPID_GUESS" | "SECTION_ORDER" | "REVIEW_EFFICIENCY" | "LATE_RUSH";
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  affected_questions: number[];
  score_impact: number;
  time_impact_seconds?: number;
  confidence: number; // 0 to 1
  recommended_order?: Subject[];
}

export interface ExamBehaviour {
  attempted: number;
  skipped: number;
  confident: number;
  uncertain: number;
}

export interface ExamAnalysis {
  score: ScoreMetrics;
  marks: MarksMetrics;
  accuracy: AccuracyMetrics;
  sectionPerformance: SectionMetrics[];
  confidence: OverallConfidence;
  pace: PaceMetrics;
  timelines: Timelines;
  mentor: StructuredInsight[];
  simulations: StrategySimulationResult;
  topicAnalysis: TopicAnalysis;
  weakTopics: string[];
  strengths: string[];
  reviewMetrics: ReviewMetrics;
  negativeMarking: RiskSummary;
  behaviour: ExamBehaviour;
  recommendations: StructuredInsight[];
}
