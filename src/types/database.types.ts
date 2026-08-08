// ============================================================
// LastMilePrep — Database TypeScript Types
// Maps to Supabase PostgreSQL schema
// Dataset v1.2.1 types are READ-ONLY interfaces
// ============================================================

/**
 * An ordered, renderable fragment of question content (v2 dataset). Stems and
 * options are arrays of these so figures, prose and tables keep their order.
 */
export interface QuestionContentBlock {
  kind: "text" | "image" | "table" | "math";
  text?: string;
  /** Stable asset key from the ingestion pipeline. */
  assetId?: string;
  /** Resolvable public image URL (present for kind === "image"). */
  url?: string | null;
  rows?: string[][];
  latex?: string;
}

/** A single option with its ordered content blocks (v2 dataset). */
export interface QuestionOptionRich {
  key: CorrectAnswer;
  index: number;
  text: string;
  isImage: boolean;
  blocks: QuestionContentBlock[];
}

export interface ValidatedQuestion {
  id: string;
  paper_name: string;
  year: number;
  shift: string;
  subject: Subject;
  question_number: number;
  question_text: string;
  question_image: string | null;
  option_a: string | null;
  option_b: string | null;
  option_c: string | null;
  option_d: string | null;
  correct_answer: CorrectAnswer;
  official_explanation: string | null;
  marks: number;
  negative_marks: number;
  source_pdf: string | null;
  is_validated: boolean;
  validated_at: string;
  dataset_version: string;
  paper_id: string | null;
  created_at: string;
  updated_at: string;

  // ---- v2 rich content (optional; populated by the exam APIs) ----
  /** Ordered stem content blocks (text + figures). */
  stem?: QuestionContentBlock[];
  /** Ordered, structured options (text or image). */
  rich_options?: QuestionOptionRich[];
  /** True when any stem/option relies on an image. */
  has_images?: boolean;
  /** Source-native id (e.g. TCS Question ID). */
  external_id?: string | null;
  /** Canonical section slug (e.g. "reasoning"). */
  section?: string;
  topic?: string | null;
}

export interface Paper {
  paper_id: string;
  paper_name_original: string;
  paper_name_canonical: string;
  exam: string;
  year: number;
  tier: string;
  paper_date: string | null;
  shift: string | null;
  paper_type: PaperType;
  expected_questions: number;
  validated_questions: number;
  source_pdf: string | null;
  dataset_version: string;
  created_at: string;
}

// ============================================================
// CBT ENGINE TABLES
// ============================================================

export interface ExamAttempt {
  id: string;
  user_id: string;
  exam_type: ExamType;
  paper_id: string | null;
  title: string;
  subject_filter: string | null;
  year_filter: number | null;
  paper_type_filter: string | null;
  total_questions: number;
  time_limit_seconds: number;
  marks_per_question: number;
  negative_marks_per_question: number;
  status: ExamStatus;
  total_answered: number;
  total_correct: number;
  total_wrong: number;
  total_skipped: number;
  total_marked_for_review: number;
  score: number;
  max_score: number;
  percentage: number;
  section_breakdown: SectionBreakdown[] | null;
  started_at: string;
  submitted_at: string | null;
  time_spent_seconds: number;
  difficulty_level: string | null;
  created_at: string;
  updated_at: string;
}

export interface AttemptAnswer {
  id: string;
  attempt_id: string;
  question_id: string;
  selected_option: CorrectAnswer | null;
  is_correct: boolean | null;
  is_marked_for_review: boolean;
  is_visited: boolean;
  marks_awarded: number;
  time_spent_seconds: number;
  question_index: number;
  created_at: string;
  updated_at: string;
}

export interface UserBookmark {
  id: string;
  user_id: string;
  question_id: string;
  note: string | null;
  created_at: string;
}

export interface UserAnalytics {
  id: string;
  user_id: string;
  subject: Subject;
  total_attempted: number;
  total_correct: number;
  total_wrong: number;
  total_skipped: number;
  accuracy: number;
  avg_time_per_question: number;
  total_time_spent_seconds: number;
  total_exams_taken: number;
  best_streak: number;
  current_streak: number;
  created_at: string;
  updated_at: string;
}

export interface StudySession {
  id: string;
  user_id: string;
  session_type: SessionType;
  attempt_id: string | null;
  subject: string | null;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number;
  questions_reviewed: number;
  created_at: string;
}

export interface QuestionReport {
  id: string;
  user_id: string;
  question_id: string;
  report_type: ReportType;
  description: string | null;
  status: ReportStatus;
  admin_notes: string | null;
  reviewed_at: string | null;
  created_at: string;
}

// ============================================================
// ENUMS
// ============================================================

export type Subject =
  | "General Intelligence & Reasoning"
  | "Quantitative Aptitude"
  | "General Awareness"
  | "English Comprehension";

export type CorrectAnswer = "A" | "B" | "C" | "D";

export type PaperType =
  | "official_question_paper"
  | "tcs_response_sheet"
  | "official_answer_key"
  | "solved_book"
  | "similar_practice_paper"
  | "candidate_summary"
  | "incomplete_scan"
  | "unsupported_document";

export type ExamType =
  | "previous_year_paper"
  | "subject_test"
  | "random_test"
  | "custom_test";

export type ExamStatus =
  | "in_progress"
  | "completed"
  | "auto_submitted"
  | "abandoned";

export type SessionType =
  | "exam"
  | "revision"
  | "bookmark_review"
  | "wrong_answer_review";

export type ReportType =
  | "wrong_answer"
  | "wrong_question"
  | "wrong_options"
  | "wrong_explanation"
  | "missing_image"
  | "formatting_issue"
  | "duplicate"
  | "other";

export type ReportStatus = "pending" | "reviewed" | "fixed" | "rejected";

// ============================================================
// SECTION BREAKDOWN (JSONB)
// ============================================================

export interface SectionBreakdown {
  subject: Subject;
  total: number;
  answered: number;
  correct: number;
  wrong: number;
  skipped: number;
  score: number;
  accuracy: number;
}

// ============================================================
// API REQUEST / RESPONSE TYPES
// ============================================================

export interface StartExamRequest {
  exam_type: ExamType;
  paper_id?: string;
  subject?: Subject;
  year?: number;
  paper_type?: PaperType;
  total_questions?: number;
  time_limit_minutes?: number;
  title?: string;
}

export interface StartExamResponse {
  attempt_id: string;
  exam_type: ExamType;
  title: string;
  total_questions: number;
  time_limit_seconds: number;
  questions: ValidatedQuestion[];
  started_at: string;
}

export interface SaveAnswerRequest {
  question_id: string;
  selected_option: CorrectAnswer | null;
  is_marked_for_review?: boolean;
  is_visited?: boolean;
  time_spent_seconds?: number;
  confidence?: "guessed" | "unsure" | "confident";
  visit_order?: number | null;
}

export interface SubmitExamResponse {
  attempt_id: string;
  status: ExamStatus;
  total_answered: number;
  total_correct: number;
  total_wrong: number;
  total_skipped: number;
  score: number;
  max_score: number;
  percentage: number;
  section_breakdown: SectionBreakdown[];
}

export interface ExamResultResponse {
  attempt: ExamAttempt;
  answers: (AttemptAnswer & {
    question: ValidatedQuestion;
  })[];
  section_breakdown: SectionBreakdown[];
}

export interface QuestionsQueryParams {
  subject?: Subject;
  year?: number;
  paper_type?: PaperType;
  paper_id?: string;
  limit?: number;
  offset?: number;
  random?: boolean;
}

export interface AnalyticsResponse {
  subjects: UserAnalytics[];
  overall: {
    total_attempted: number;
    total_correct: number;
    total_wrong: number;
    accuracy: number;
    total_exams_taken: number;
    total_time_spent_seconds: number;
  };
  weak_topics: Subject[];
}

export interface RevisionQueueResponse {
  questions: (ValidatedQuestion & {
    times_wrong: number;
    last_attempted: string;
  })[];
  total: number;
}

export interface BookmarkRequest {
  question_id: string;
  note?: string;
}

export interface ExamHistoryResponse {
  attempts: ExamAttempt[];
  total: number;
}
