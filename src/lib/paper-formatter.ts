/**
 * LastMilePrep — Paper display-name formatter.
 * Hides raw internal filenames, canonical names, PDF filenames and ingestion
 * labels, and presents a clean, EXAM-AWARE name.
 *
 *  - SSC CGL (the default exam) keeps its established "SSC CGL {Year} Tier {I/II}
 *    {Shift}" format.
 *  - Every other exam (SBI Clerk, IBPS Clerk, …) is named from its OWN metadata:
 *    "{Exam Name} · {Day Month Year} · {Shift}", with the date parsed from the
 *    paper's canonical/original name when present. Nothing is fabricated — a date
 *    or shift that isn't known is simply omitted (an undated memory-based paper
 *    falls back to a plain "Set N" disambiguator so the dropdown stays usable).
 */

export interface PaperMetaData {
  paper_id?: string;
  paper_name_canonical?: string;
  paper_name_original?: string;
  source_document?: string | null;
  year?: number | null;
  shift?: string | null;
  tier?: string | null;
  paper_type?: string | null;
  index?: number;
}

const MONTHS: Record<string, string> = {
  jan: "January", feb: "February", mar: "March", apr: "April", may: "May", jun: "June",
  jul: "July", aug: "August", sep: "September", oct: "October", nov: "November", dec: "December",
};

/** Parse "2 Sep 2023", "4-Oct-2025", "26 August 2023", "4th September 2022",
 *  "12_Dec_2020" → {day, month, year}, or null. */
function parseDate(s: string): { day: number; month: string; year: number } | null {
  const m = s.match(/(\d{1,2})(?:st|nd|rd|th)?[-_ ]?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[-_ ,]*(20\d{2})/i);
  if (!m) return null;
  return { day: parseInt(m[1], 10), month: MONTHS[m[2].toLowerCase()], year: parseInt(m[3], 10) };
}

/** Parse a shift number from free text ("Shift 1", "4th-shift", "shift-2"). */
function parseShift(s: string): string {
  const m = s.match(/shift[-_\s]*([1-4])/i) || s.match(/\b([1-4])(?:st|nd|rd|th)[-_\s]*shift/i);
  return m ? `Shift ${m[1]}` : "";
}

export function formatPaperDisplayName(paper: PaperMetaData, index?: number, examName?: string): string {
  const isSSC = !examName || /^ssc/i.test(examName);

  // ---- SSC CGL (default exam): keep the established Tier-based format ----
  if (isSSC) {
    const yearStr = paper.year ? paper.year.toString() : "2024";
    const tierStr = paper.tier ? (paper.tier.includes("2") || paper.tier.includes("II") ? "Tier II" : "Tier I") : "Tier I";
    let shiftStr = "";
    if (paper.shift) {
      const sLower = paper.shift.toLowerCase();
      const m = sLower.match(/shift[-\s]?([1-4])/) || (/^[1-4]$/.test(sLower) ? [null, sLower] : null);
      shiftStr = m ? `Shift ${m[1]}` : paper.shift;
    }
    if (paper.paper_type && /similar|practice|model/.test(paper.paper_type)) {
      const num = (index !== undefined ? index + 1 : 1).toString().padStart(2, "0");
      return `SSC CGL ${yearStr} ${tierStr} Practice Test ${num}`;
    }
    return `SSC CGL ${yearStr} ${tierStr}${shiftStr ? ` ${shiftStr}` : ""}`;
  }

  // ---- Other exams: name from the paper's own metadata ----
  const hay = [paper.paper_name_canonical, paper.paper_name_original, paper.source_document]
    .filter(Boolean).join(" ");
  const d = parseDate(hay);
  const shift = (paper.shift && parseShift(paper.shift)) || parseShift(hay);

  let label = examName;
  if (d) label += ` · ${d.day} ${d.month} ${d.year}`;
  else if (paper.year) label += ` · ${paper.year}`;
  if (shift) label += ` · ${shift}`;

  // Undated, shift-less memory-based paper: disambiguate so the dropdown is usable.
  if (!d && !paper.year && !shift) {
    label += ` · Set ${index !== undefined ? index + 1 : 1}`;
  }
  return label;
}
