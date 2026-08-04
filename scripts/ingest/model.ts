/**
 * Canonical ingestion model for the SSC CGL question bank.
 *
 * These types are the single source of truth that every DOCX parser must
 * produce, and that the database loader consumes. They are intentionally
 * decoupled from the DB schema so that parsers never need to know about SQL,
 * and the loader is the only place that maps this model onto tables.
 *
 * Design goals:
 *  - Preserve content fidelity: text, images, tables and math live as ordered
 *    `ContentBlock`s so nothing is lost or reflowed.
 *  - Be answer-source honest: we never fabricate a correct answer. When a
 *    source does not carry a verifiable key, `correctOption` stays null and
 *    `needsAnswerKey` is true.
 *  - Be multilingual and multi-exam ready from day one.
 */

export type OptionKey = "A" | "B" | "C" | "D";

export const OPTION_KEYS: OptionKey[] = ["A", "B", "C", "D"];

/** Canonical SSC section identifiers (stable across UI, analytics, DB). */
export type ExamSection =
  | "reasoning"
  | "general_awareness"
  | "quantitative_aptitude"
  | "english_comprehension"
  | "statistics"
  | "general_studies"
  | "finance_economics"
  | "unknown";

export type Language = "en" | "hi" | "bi";

export type Difficulty = "easy" | "medium" | "hard";

/**
 * How a question's correct answer was determined. This is persisted so the app
 * can visibly distinguish an officially-keyed answer from a lower-trust source.
 */
export type AnswerSource =
  | "official_key" // matched against an SSC/official answer key
  | "chosen_option" // TCS response sheet: candidate's chosen option (user-approved as truth)
  | "solved_paper" // publisher solved-paper marked answer
  | "unknown";

export type AnswerStatus =
  | "answered"
  | "not_answered"
  | "marked_for_review"
  | "not_attempted_marked"
  | "unknown";

/** The DOCX source format a paper was parsed from. */
export type PaperFormat = "tcs_response_sheet" | "publisher_solved_paper";

/**
 * An ordered fragment of renderable content. A stem or an option is a list of
 * these, preserving the original document order of prose, figures and tables.
 */
export interface ContentBlock {
  kind: "text" | "image" | "table" | "math";
  /** Present for kind === "text". */
  text?: string;
  /** Present for kind === "image": references a RawAsset.id. */
  assetId?: string;
  /** Present for kind === "image" after loading: resolvable public URL. */
  url?: string | null;
  /** Present for kind === "table": rows of cell strings. */
  rows?: string[][];
  /** Present for kind === "math": TeX source (reserved for future OCR). */
  latex?: string;
}

export interface ParsedOption {
  key: OptionKey;
  /** 1-based option index as it appeared in the source. */
  index: number;
  blocks: ContentBlock[];
  /** Flattened plain text of the option (may be empty for image-only options). */
  text: string;
  /** True when the option's meaning lives in an image rather than text. */
  isImage: boolean;
}

export interface ParsedQuestion {
  /** 1-based position within the paper. */
  questionNumber: number;
  /** Source-native id (e.g. TCS "Question ID"); null when the source has none. */
  externalId: string | null;
  section: ExamSection;
  /** Fine-grained topic; null until a classifier assigns it. */
  topic: string | null;
  difficulty: Difficulty | null;

  stemBlocks: ContentBlock[];
  /** Flattened plain text of the stem (for search / previews). */
  stemText: string;
  /** True when any stem or option relies on an image. */
  hasImages: boolean;

  options: ParsedOption[];
  correctOption: OptionKey | null;
  answerStatus: AnswerStatus;
  answerSource: AnswerSource;
  /** True when no trustworthy correct answer could be established. */
  needsAnswerKey: boolean;

  solutionBlocks: ContentBlock[];
  solutionText: string;

  language: Language;
  marks: number;
  negativeMarks: number;

  /** Non-fatal issues detected while parsing this question. */
  warnings: string[];
}

/** A binary asset (image) extracted from the DOCX media folder. */
export interface RawAsset {
  /** Stable id, unique within the paper: `${paperId}__img${n}`. */
  id: string;
  /** Original path inside the DOCX zip, e.g. "word/media/image12.png". */
  mediaPath: string;
  ext: string;
  sha256: string;
  byteLength: number;
  /** Populated by the reader; omitted when serialising to JSON. */
  bytes?: Buffer;
}

export interface PaperMeta {
  paperId: string;
  title: string;
  exam: string; // "SSC CGL"
  tier: string; // "Tier 1"
  year: number | null;
  examDate: string | null; // ISO yyyy-mm-dd
  shift: string | null;
  language: Language;
  sourceDocument: string; // original filename
  format: PaperFormat;
}

export interface ParsedPaper extends PaperMeta {
  sectionsOrder: ExamSection[];
  questions: ParsedQuestion[];
  assets: RawAsset[];
  stats: ParsePaperStats;
}

export interface ParsePaperStats {
  totalQuestions: number;
  answered: number;
  notAnswered: number;
  markedForReview: number;
  withCorrectAnswer: number;
  needsAnswerKey: number;
  imageQuestions: number;
  textQuestions: number;
  bySection: Record<string, number>;
  totalAssets: number;
  usedAssets: number;
  warnings: number;
}

/** Flatten an ordered block list to plain text for search / previews. */
export function blocksToText(blocks: ContentBlock[]): string {
  return blocks
    .map((b) => {
      if (b.kind === "text") return b.text ?? "";
      if (b.kind === "image") return ""; // images contribute no searchable text here
      if (b.kind === "table")
        return (b.rows ?? []).map((r) => r.join(" | ")).join("\n");
      if (b.kind === "math") return b.latex ?? "";
      return "";
    })
    .filter(Boolean)
    .join("\n")
    .trim();
}

export function optionKeyFromIndex(index1Based: number): OptionKey | null {
  return OPTION_KEYS[index1Based - 1] ?? null;
}
