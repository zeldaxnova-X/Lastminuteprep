/**
 * LastMilePrep, Text Artifact Sanitizer & Formatter (Sprint 1.1 Hardened)
 * Strips extraction artifacts like `[Official SSC CGL 2024...]`, `[Official PYP...]`,
 * `Official SSC...`, `Official...`, `Practice...`, `PDF...`, `Source...`
 * from question text, option text, and explanations during render.
 * Leaves database completely untouched.
 */
export function sanitizeQuestionText(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .replace(/^\[Official[^\]]*\]\s*/gi, "")
    .replace(/^\[SSC CGL[^\]]*\]\s*/gi, "")
    .replace(/^\[Practice[^\]]*\]\s*/gi, "")
    .replace(/^Official SSC CGL \d+ [^\n:]+[\n:]\s*/gi, "")
    .replace(/^Official SSC [^\n:]+[\n:]\s*/gi, "")
    .replace(/^Official [^\n:]+[\n:]\s*/gi, "")
    .replace(/^Practice Test \d+ [^\n:]+[\n:]\s*/gi, "")
    .replace(/^Source PDF: [^\n]+\n?/gi, "")
    .replace(/^Source: [^\n]+\n?/gi, "")
    .replace(/^PDF: [^\n]+\n?/gi, "")
    .replace(/\(Extracted from Official [^\)]+\)/gi, "")
    .replace(/Official [A-Z0-9 ]+ Solution:\s*/gi, "")
    .replace(/Official [A-Z0-9 ]+ Answer Key:\s*/gi, "")
    .trim();
}
