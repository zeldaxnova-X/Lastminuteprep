// ============================================================
// LastMilePrep — Root Exam Analyzer Orchestrator
// Single Source of Truth for all post-exam metrics
// Orchestrates score, pace, confidence, section, timeline, topic,
// risk, review, simulation, and mentor analyzers.
// ============================================================

import type { ExamAttemptInput, ExamAnalysis, ExamBehaviour } from "./types";
import { analyzeScore } from "./score-analyzer";
import { analyzePace } from "./pace-analyzer";
import { analyzeConfidence } from "./confidence-analyzer";
import { analyzeSections } from "./section-analyzer";
import { analyzeTimelines } from "./timeline-analyzer";
import { analyzeTopics } from "./topic-analyzer";
import { analyzeRisk } from "./risk-analyzer";
import { analyzeReview } from "./review-analyzer";
import { simulateStrategy } from "./simulation-engine";
import { generateStructuredInsights } from "./mentor-engine";

export function analyzeExamAttempt(attempt: ExamAttemptInput): ExamAnalysis {
  // 1. Score, Marks, Accuracy
  const { score, marks, accuracy } = analyzeScore(attempt);

  // 2. Pace & Timing
  const pace = analyzePace(attempt);

  // 3. Confidence Estimation
  const confidence = analyzeConfidence(attempt);

  // 4. Section Performance
  const sectionPerformance = analyzeSections(attempt);

  // 5. Timelines (Numeric arrays for Recharts)
  const timelines = analyzeTimelines(attempt);

  // 6. Topic Analysis
  const topicAnalysis = analyzeTopics(attempt);
  const weakTopics = topicAnalysis.weak_topics.map((t) => `${t.subject}: ${t.topic}`);
  const strengths = topicAnalysis.strong_topics.map((t) => `${t.subject}: ${t.topic}`);

  // 7. Risk Analysis
  const negativeMarking = analyzeRisk(attempt);

  // 8. Review Metrics
  const reviewMetrics = analyzeReview(attempt);

  // 9. Strategy Replay Simulation
  const simulations = simulateStrategy(attempt);

  // 10. Structured Insights
  const mentor = generateStructuredInsights(attempt);

  // 11. Overall Exam Behaviour
  const attemptedCount = accuracy.attempted_count;
  const skippedCount = accuracy.skipped_count;

  const behaviour: ExamBehaviour = {
    attempted: attemptedCount,
    skipped: skippedCount,
    confident: confidence.high_count,
    uncertain: confidence.low_count,
  };

  return {
    score,
    marks,
    accuracy,
    sectionPerformance,
    confidence,
    pace,
    timelines,
    mentor,
    simulations,
    topicAnalysis,
    weakTopics,
    strengths,
    reviewMetrics,
    negativeMarking,
    behaviour,
    recommendations: mentor,
  };
}

export * from "./types";
