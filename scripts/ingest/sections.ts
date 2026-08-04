/**
 * SSC section detection and normalisation.
 *
 * Papers label sections inconsistently ("General Intelligence and Reasoning",
 * "Reasoning", "General Awareness", "GK/GS", ...). We normalise every variant to
 * a single canonical `ExamSection` used throughout the app, analytics and DB.
 */
import type { ExamSection } from "./model";

interface SectionRule {
  section: ExamSection;
  patterns: RegExp[];
}

const SECTION_RULES: SectionRule[] = [
  {
    section: "reasoning",
    patterns: [/general\s+intelligence/i, /\breasoning\b/i],
  },
  {
    section: "general_awareness",
    patterns: [/general\s+awareness/i, /general\s+knowledge/i, /\bGK\b/, /\bGS\b/],
  },
  {
    section: "quantitative_aptitude",
    patterns: [/quantitative\s+aptitude/i, /\bquantitative\b/i, /\bmaths?\b/i, /numerical\s+aptitude/i],
  },
  {
    section: "english_comprehension",
    patterns: [/english\s+comprehension/i, /english\s+language/i, /\benglish\b/i],
  },
  {
    section: "statistics",
    patterns: [/\bstatistics\b/i],
  },
  {
    section: "finance_economics",
    patterns: [/finance\s+and\s+economics/i, /\beconomics\b/i, /\bfinance\b/i],
  },
  {
    section: "general_studies",
    patterns: [/general\s+studies/i],
  },
];

/** Human-readable label for a canonical section. */
export const SECTION_LABELS: Record<ExamSection, string> = {
  reasoning: "General Intelligence and Reasoning",
  general_awareness: "General Awareness",
  quantitative_aptitude: "Quantitative Aptitude",
  english_comprehension: "English Comprehension",
  statistics: "Statistics",
  general_studies: "General Studies",
  finance_economics: "Finance and Economics",
  unknown: "Unknown",
};

/**
 * If `line` is a section header, return its canonical section. A header is a
 * line that is (mostly) just a section name, optionally prefixed by "Section :".
 */
export function matchSectionHeader(line: string): ExamSection | null {
  const raw = line.trim();
  if (!raw) return null;

  const explicit = /^section\s*:?\s*(.+)$/i.exec(raw);
  const candidate = explicit ? explicit[1] : raw;

  // A genuine header is short. Reject long prose that merely mentions a subject.
  if (candidate.length > 60) return null;

  for (const rule of SECTION_RULES) {
    if (rule.patterns.some((p) => p.test(candidate))) {
      // For non-explicit headers, require the line to look like a heading
      // (no trailing sentence punctuation, few words).
      if (!explicit && (candidate.length > 45 || /[.?!]$/.test(candidate))) continue;
      return rule.section;
    }
  }
  return null;
}

/** Default ordered sections for an SSC CGL Tier-1 paper. */
export const SSC_CGL_TIER1_SECTIONS: ExamSection[] = [
  "reasoning",
  "general_awareness",
  "quantitative_aptitude",
  "english_comprehension",
];
