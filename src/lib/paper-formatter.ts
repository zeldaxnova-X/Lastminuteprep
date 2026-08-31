/**
 * LastMilePrep, Paper Display Name Formatter
 * Hides raw internal filenames, canonical names, PDF filenames, and dataset ingestion labels.
 * Formats as: "SSC CGL {Year} Tier {I/II} Shift {1/2/3/4}"
 */

export interface PaperMetaData {
  paper_id?: string;
  paper_name_canonical?: string;
  paper_name_original?: string;
  year?: number;
  shift?: string | null;
  tier?: string | null;
  paper_type?: string | null;
  index?: number;
}

export function formatPaperDisplayName(paper: PaperMetaData, index?: number): string {
  const yearStr = paper.year ? paper.year.toString() : "2024";
  const tierStr = paper.tier ? (paper.tier.includes("2") || paper.tier.includes("II") ? "Tier II" : "Tier I") : "Tier I";

  let shiftStr = "";
  if (paper.shift) {
    const sLower = paper.shift.toLowerCase();
    if (sLower.includes("shift 1") || sLower.includes("shift-1") || sLower === "1") shiftStr = "Shift 1";
    else if (sLower.includes("shift 2") || sLower.includes("shift-2") || sLower === "2") shiftStr = "Shift 2";
    else if (sLower.includes("shift 3") || sLower.includes("shift-3") || sLower === "3") shiftStr = "Shift 3";
    else if (sLower.includes("shift 4") || sLower.includes("shift-4") || sLower === "4") shiftStr = "Shift 4";
    else shiftStr = paper.shift;
  }

  // Check if it's a practice paper
  if (paper.paper_type && (paper.paper_type.includes("similar") || paper.paper_type.includes("practice") || paper.paper_type.includes("model"))) {
    const num = (index !== undefined ? index + 1 : 1).toString().padStart(2, "0");
    return `SSC CGL ${yearStr} ${tierStr} Practice Test ${num}`;
  }

  if (shiftStr) {
    return `SSC CGL ${yearStr} ${tierStr} ${shiftStr}`;
  }

  return `SSC CGL ${yearStr} ${tierStr}`;
}
