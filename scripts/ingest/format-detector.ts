/**
 * Detects which known DOCX layout a paper uses so the right parser runs, and
 * derives paper-level metadata (exam, year, date, shift) from the filename and
 * document header. Adding a new source format = add a branch here + a parser.
 */
import { basename } from "node:path";
import type { DocxDocument } from "./docx-reader";
import type { Language, PaperFormat, PaperMeta } from "./model";

export function detectFormat(doc: DocxDocument): PaperFormat {
  const head = doc.fullText.slice(0, 20000);
  const hasTcsMarkers =
    /Question ID\s*:/.test(head) &&
    /Chosen Option\s*:/.test(doc.fullText.slice(0, 60000)) &&
    /Status\s*:/.test(head);
  if (hasTcsMarkers) return "tcs_response_sheet";
  return "publisher_solved_paper";
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

function toIsoDate(day: number, month: number, year: number): string | null {
  if (!day || !month || !year) return null;
  if (day < 1 || day > 31 || month < 1 || month > 12) return null;
  const y = year < 100 ? 2000 + year : year;
  return `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Parse a date from the document header, e.g. "Exam Date 14/07/2023". */
function parseDateFromText(text: string): string | null {
  const dmy = /(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})/.exec(text);
  if (dmy) return toIsoDate(+dmy[1], +dmy[2], +dmy[3]);
  const named = /(\d{1,2})(?:st|nd|rd|th)?[-\s]+([A-Za-z]{3,9})[-\s]+(\d{4})/.exec(text);
  if (named) {
    const mon = MONTHS[named[2].slice(0, 3).toLowerCase()];
    if (mon) return toIsoDate(+named[1], mon, +named[3]);
  }
  return null;
}

/** Parse "…-Shift-1" / "Shift 2" / time-window into a shift label. */
function parseShift(filename: string, headerText: string): string | null {
  const f = /shift[-_\s]*([0-9IVX]+)/i.exec(filename);
  if (f) return `Shift ${normaliseShiftNum(f[1])}`;
  const h = /shift[-_\s]*([0-9IVX]+)/i.exec(headerText);
  if (h) return `Shift ${normaliseShiftNum(h[1])}`;
  return null;
}

function normaliseShiftNum(s: string): string {
  const roman: Record<string, string> = { i: "1", ii: "2", iii: "3", iv: "4" };
  return roman[s.toLowerCase()] ?? s;
}

function detectLanguage(fullText: string): Language {
  const hasDevanagari = /[ऀ-ॿ]/.test(fullText);
  const latinCount = (fullText.match(/[A-Za-z]/g) || []).length;
  if (hasDevanagari && latinCount > 200) return "bi";
  if (hasDevanagari) return "hi";
  return "en";
}

function detectTier(filename: string, text: string): string {
  if (/tier[-_\s]*2|tier[-_\s]*ii|paper[-_\s]*ii/i.test(filename + text)) return "Tier 2";
  return "Tier 1";
}

export function extractPaperMeta(
  filePath: string,
  doc: DocxDocument,
  format: PaperFormat
): PaperMeta {
  const filename = basename(filePath);
  const header = doc.fullText.slice(0, 4000);

  const year =
    Number((/\b(20\d{2})\b/.exec(filename) || /\b(20\d{2})\b/.exec(header) || [])[1]) || null;
  const examDate = parseDateFromText(header) || parseDateFromText(filename);
  const shift = parseShift(filename, header);
  const tier = detectTier(filename, header);
  const language = detectLanguage(doc.fullText);
  const exam = "SSC CGL";

  const parts = [exam, tier, year, examDate, shift].filter(Boolean).join(" ");
  const paperId = slugify(parts || filename.replace(/\.docx$/i, ""));

  const title = [exam, tier, examDate ? `— ${examDate}` : "", shift ? `(${shift})` : ""]
    .filter(Boolean)
    .join(" ")
    .trim();

  return {
    paperId,
    title,
    exam,
    tier,
    year,
    examDate,
    shift,
    language,
    sourceDocument: filename,
    format,
  };
}
