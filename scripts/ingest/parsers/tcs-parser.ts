/**
 * Parser for TCS official response-sheet DOCX exports (SSC CGL 2023+, and the
 * Jan Tier-II exports that share the layout).
 *
 * Record model (reverse-engineered from the source):
 *   Each question's content appears BEFORE its metadata. The metadata triple
 *   is the record delimiter:
 *       Question ID : <id>
 *       Status      : Answered | Not Answered | Marked For Review | ...
 *       Chosen Option : <1-4>            (blank when not answered)
 *   Everything between the previous delimiter and this one is the question:
 *       [Q.N]  <stem paragraphs / figures>
 *       Ans
 *       1. <opt>   2. <opt>   3. <opt>   4. <opt>   (text or images)
 *
 * The correct answer is taken from `Chosen Option` per an explicit product
 * decision. When a question was not answered, no option is chosen, so we leave
 * `correctOption` null and flag `needsAnswerKey` rather than fabricate a key.
 */
import { AssetRegistry } from "../assets";
import type { DocElement, DocParagraph, DocxDocument } from "../docx-reader";
import {
  blocksToText,
  optionKeyFromIndex,
  type AnswerStatus,
  type ContentBlock,
  type ExamSection,
  type Language,
  type OptionKey,
  type ParsedOption,
  type ParsedPaper,
  type ParsedQuestion,
  type PaperMeta,
  type ParsePaperStats,
} from "../model";
import { matchSectionHeader, SSC_CGL_TIER1_SECTIONS } from "../sections";

const MARKS_PER_Q = 2;
const NEG_MARKS_PER_Q = 0.5;

const RE_QUESTION_ID = /^Question ID\s*:\s*(\S+)/i;
const RE_STATUS = /^Status\s*:\s*(.+)$/i;
const RE_CHOSEN = /^Chosen Option\s*:\s*(\S+)?/i;
/** Non-answer metadata labels that appear inside the delimiter block. */
const RE_METADATA_LABEL = /^(Option\s*\d+\s*ID|Question Type|Section\s*Id|Time\s*Taken|Question Number)\s*:/i;
const RE_QNUM_PREFIX = /^Q\.?\s*(\d+)\s*[.)]?\s*/i;
/** Inline answer marker: "… Ans 1. <option1>" (option 1 fused into the stem). */
const RE_ANS_INLINE = /\bAns\s+1\s*[.)]\s*/i;
/** Standalone answer marker: a paragraph that is just "Ans". */
const RE_ANS_STANDALONE = /^Ans\s*$/i;
/** Leading numeric option marker, e.g. "2." or "3)". */
const RE_OPTION_START = /^\s*(\d)\s*[.)]\s*/;

interface RawRecord {
  content: DocParagraph[];
  externalId: string | null;
  status: AnswerStatus;
  chosen: number | null;
  section: ExamSection;
}

function normaliseStatus(s: string): AnswerStatus {
  const t = s.replace(/\s+/g, " ").trim().toLowerCase();
  if (t.startsWith("answered")) return "answered";
  if (t.includes("not attempted") && t.includes("marked")) return "not_attempted_marked";
  if (t.startsWith("not answered")) return "not_answered";
  if (t.includes("marked")) return "marked_for_review";
  return "unknown";
}

/** Index of the first "Q.N" heading, used to strip the candidate/exam header. */
function firstQuestionIndex(elements: DocElement[]): number {
  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    if (el.type === "paragraph" && RE_QNUM_PREFIX.test(el.text)) return i;
  }
  return 0;
}

/** Split the ordered element stream into per-question records. */
function splitRecords(elements: DocElement[]): RawRecord[] {
  const records: RawRecord[] = [];
  let buffer: DocParagraph[] = [];
  let section: ExamSection = SSC_CGL_TIER1_SECTIONS[0];
  let sectionSeen = false;

  // Drop the TCS candidate/exam header block that precedes the first question.
  const start = firstQuestionIndex(elements);

  for (let i = start; i < elements.length; i++) {
    const el = elements[i];
    if (el.type !== "paragraph") {
      // Tables are rare in TCS exports; fold their text into the buffer as a
      // synthetic paragraph so no content is dropped.
      const text = el.rows.map((r) => r.join("  ")).join("\n");
      buffer.push({ type: "paragraph", index: el.index, text, imageRels: el.imageRels });
      continue;
    }

    // Section header?
    const maybeSection = matchSectionHeader(el.text);
    if (maybeSection) {
      section = maybeSection;
      sectionSeen = true;
      continue;
    }

    // Start of a metadata block => close the current question. The metadata
    // region is: Question ID, [Option N ID …], [Question Type], Status,
    // Chosen Option — in that rough order, with blank lines interspersed and
    // extra label lines in the Tier-II layout. We scan forward, skipping known
    // label/blank lines, until real content or the next Question ID.
    const idMatch = RE_QUESTION_ID.exec(el.text);
    if (idMatch) {
      const externalId = idMatch[1];
      let status: AnswerStatus = "unknown";
      let chosen: number | null = null;

      let j = i + 1;
      let guard = 0;
      while (j < elements.length && guard++ < 20) {
        const nx = elements[j];
        if (nx.type !== "paragraph") break;
        const tx = nx.text;
        if (tx === "") { j++; continue; }
        if (RE_QUESTION_ID.test(tx)) break; // next record
        const st = RE_STATUS.exec(tx);
        if (st) { status = normaliseStatus(st[1]); j++; continue; }
        const ch = RE_CHOSEN.exec(tx);
        if (ch) {
          const v = ch[1] ? parseInt(ch[1], 10) : NaN;
          chosen = Number.isFinite(v) && v >= 1 && v <= 4 ? v : null;
          j++;
          continue;
        }
        if (RE_METADATA_LABEL.test(tx)) { j++; continue; }
        break; // genuine content — metadata block has ended
      }

      records.push({ content: buffer, externalId, status, chosen, section });
      buffer = [];
      i = j - 1; // resume at the first content paragraph of the next question
      continue;
    }

    // Ordinary content paragraph.
    buffer.push(el);
  }

  // If the document defined no explicit section headers, keep the default.
  void sectionSeen;
  return records;
}

/** Convert a run of paragraphs into ordered content blocks via the registry. */
function paragraphsToBlocks(
  paras: DocParagraph[],
  assets: AssetRegistry
): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  for (const p of paras) {
    if (p.text) blocks.push({ kind: "text", text: p.text });
    for (const rel of p.imageRels) {
      const assetId = assets.resolve(rel);
      if (assetId) blocks.push({ kind: "image", assetId });
    }
  }
  return blocks;
}

/** A paragraph carries content if it has text or an embedded image. */
function hasContent(p: DocParagraph): boolean {
  return p.text.trim() !== "" || p.imageRels.length > 0;
}

/**
 * Split a question's content paragraphs into stem vs the four options.
 *
 * Handles both TCS layouts:
 *   - Text questions: option 1 is fused into the stem paragraph as
 *     "… Ans 1. <opt1>", and options 2–4 are the following paragraphs whose
 *     numeric markers are rendered as images (so they carry no numeric text).
 *   - Figure questions: a standalone "Ans" paragraph followed by explicitly
 *     numbered "1." … "4." paragraphs (option content is imagery).
 */
function splitStemAndOptions(paras: DocParagraph[]): {
  stem: DocParagraph[];
  optionGroups: DocParagraph[][];
  warnings: string[];
} {
  const warnings: string[] = [];

  // 1) Locate the answer marker (inline "Ans 1." or standalone "Ans").
  let markerIdx = -1;
  let inline: { stemHead: string; opt1: string } | null = null;
  for (let i = 0; i < paras.length; i++) {
    const inlineMatch = RE_ANS_INLINE.exec(paras[i].text);
    if (inlineMatch) {
      markerIdx = i;
      inline = {
        stemHead: paras[i].text.slice(0, inlineMatch.index).trim(),
        opt1: paras[i].text.slice(inlineMatch.index + inlineMatch[0].length).trim(),
      };
      break;
    }
    if (RE_ANS_STANDALONE.test(paras[i].text)) {
      markerIdx = i;
      break;
    }
  }

  // Fallback: first bare "1." paragraph (no visible "Ans" at all).
  let impliedStart = false;
  if (markerIdx === -1) {
    markerIdx = paras.findIndex((p) => /^\s*1\s*[.)]/.test(p.text));
    impliedStart = markerIdx !== -1;
    if (markerIdx === -1) {
      warnings.push("no-ans-marker");
      return { stem: paras, optionGroups: [], warnings };
    }
  }

  // 2) Build stem and the ordered option region.
  const stem: DocParagraph[] = paras.slice(0, markerIdx);
  const optionRegion: DocParagraph[] = [];
  const marker = paras[markerIdx];

  if (inline) {
    const stemHadContent = stem.some(hasContent) || inline.stemHead !== "";
    if (inline.stemHead) stem.push({ ...marker, text: inline.stemHead, imageRels: [] });
    if (!stemHadContent && marker.imageRels.length > 0) {
      // The stem is otherwise empty, so the marker paragraph's images are the
      // question figure, not option-1 icons: route them to the stem.
      stem.push({ ...marker, text: "", imageRels: marker.imageRels });
      optionRegion.push({ ...marker, text: inline.opt1, imageRels: [] });
    } else {
      // Option 1 head keeps the marker paragraph's images (option icons/figures).
      optionRegion.push({ ...marker, text: inline.opt1 });
    }
    optionRegion.push(...paras.slice(markerIdx + 1));
  } else if (impliedStart) {
    optionRegion.push(...paras.slice(markerIdx));
  } else {
    // Standalone "Ans": options are the following paragraphs.
    optionRegion.push(...paras.slice(markerIdx + 1));
  }

  const content = optionRegion.filter(hasContent);

  // 3) Group into options. If explicit 2./3. markers exist, group by number
  //    (figure questions); otherwise each content paragraph is one option.
  const explicitlyNumbered =
    content.filter((p) => /^\s*[2-4]\s*[.)]/.test(p.text)).length >= 2;

  const groups: DocParagraph[][] = [];
  if (explicitlyNumbered) {
    let current: DocParagraph[] | null = null;
    for (const p of content) {
      const nm = RE_OPTION_START.exec(p.text);
      if (nm) {
        current = [{ ...p, text: p.text.replace(RE_OPTION_START, "") }];
        groups.push(current);
      } else if (current) {
        current.push(p);
      } else {
        current = [p];
        groups.push(current);
      }
    }
  } else {
    for (const p of content) {
      groups.push([{ ...p, text: p.text.replace(RE_OPTION_START, "") }]);
    }
  }

  if (groups.length > 4) warnings.push(`option-overflow=${groups.length}`);
  if (groups.length < 4) warnings.push(`option-count=${groups.length}`);
  return { stem, optionGroups: groups.slice(0, 4), warnings };
}

function buildQuestion(
  rec: RawRecord,
  qNumber: number,
  meta: PaperMeta,
  assets: AssetRegistry
): ParsedQuestion {
  const warnings: string[] = [];

  // Strip a leading "Q.N" prefix from the first paragraph that carries text.
  const content = rec.content.map((p) => ({ ...p }));
  const firstTextIdx = content.findIndex((p) => p.text.trim() !== "");
  if (firstTextIdx !== -1 && RE_QNUM_PREFIX.test(content[firstTextIdx].text)) {
    content[firstTextIdx].text = content[firstTextIdx].text.replace(RE_QNUM_PREFIX, "");
  }

  const { stem, optionGroups, warnings: splitWarnings } = splitStemAndOptions(content);
  warnings.push(...splitWarnings);

  // Remove a dangling "Ans" left on the stem when option 1 is an image.
  for (let i = stem.length - 1; i >= 0; i--) {
    if (stem[i].text.trim() === "") continue;
    stem[i] = { ...stem[i], text: stem[i].text.replace(/\s*\bAns\s*$/i, "").trim() };
    break;
  }

  const stemBlocks = paragraphsToBlocks(stem, assets);
  const options: ParsedOption[] = optionGroups.map((group, i) => {
    const key = optionKeyFromIndex(i + 1) as OptionKey;
    const flatText = group
      .map((p) => p.text.trim())
      .filter(Boolean)
      .join("\n")
      .trim();

    // A text option is text-only: the images on its line are response-sheet
    // chrome (radio/number glyphs), not content, so they are not registered.
    // An option with no text is genuinely image-based; register those images.
    if (flatText) {
      const blocks: ContentBlock[] = group
        .filter((p) => p.text.trim())
        .map((p) => ({ kind: "text", text: p.text.trim() }));
      return { key, index: i + 1, blocks, text: flatText, isImage: false };
    }
    const blocks: ContentBlock[] = [];
    for (const p of group)
      for (const rel of p.imageRels) {
        const assetId = assets.resolve(rel);
        if (assetId) blocks.push({ kind: "image", assetId });
      }
    return { key, index: i + 1, blocks, text: "", isImage: blocks.length > 0 };
  });

  const hasImages =
    stemBlocks.some((b) => b.kind === "image") || options.some((o) => o.isImage);

  // A valid chosen option is the answer (product decision), whether the
  // candidate left it flagged for review or not. "Not Answered" carries no
  // choice, so it stays unkeyed and flagged rather than fabricated.
  const correctOption = rec.chosen ? optionKeyFromIndex(rec.chosen) : null;
  const needsAnswerKey = correctOption === null;
  if (needsAnswerKey) warnings.push(`unkeyed:${rec.status}`);

  const stemText = blocksToText(stemBlocks);
  if (!stemText && !hasImages) warnings.push("empty-stem");

  return {
    questionNumber: qNumber,
    externalId: rec.externalId,
    section: rec.section,
    topic: null,
    difficulty: null,
    stemBlocks,
    stemText,
    hasImages,
    options,
    correctOption,
    answerStatus: rec.status,
    answerSource: "chosen_option",
    needsAnswerKey,
    solutionBlocks: [],
    solutionText: "",
    language: meta.language as Language,
    marks: MARKS_PER_Q,
    negativeMarks: NEG_MARKS_PER_Q,
    warnings,
  };
}

function computeStats(questions: ParsedQuestion[], totalAssets: number): ParsePaperStats {
  const bySection: Record<string, number> = {};
  let answered = 0,
    notAnswered = 0,
    marked = 0,
    withAnswer = 0,
    needsKey = 0,
    imageQ = 0,
    textQ = 0,
    warns = 0;
  const usedAssetIds = new Set<string>();

  for (const q of questions) {
    bySection[q.section] = (bySection[q.section] || 0) + 1;
    if (q.answerStatus === "answered") answered++;
    else if (q.answerStatus === "not_answered") notAnswered++;
    else if (q.answerStatus === "marked_for_review" || q.answerStatus === "not_attempted_marked")
      marked++;
    if (q.correctOption) withAnswer++;
    if (q.needsAnswerKey) needsKey++;
    if (q.hasImages) imageQ++;
    else textQ++;
    warns += q.warnings.length;
    for (const b of [...q.stemBlocks, ...q.options.flatMap((o) => o.blocks)])
      if (b.assetId) usedAssetIds.add(b.assetId);
  }

  return {
    totalQuestions: questions.length,
    answered,
    notAnswered,
    markedForReview: marked,
    withCorrectAnswer: withAnswer,
    needsAnswerKey: needsKey,
    imageQuestions: imageQ,
    textQuestions: textQ,
    bySection,
    totalAssets,
    usedAssets: usedAssetIds.size,
    warnings: warns,
  };
}

export function parseTcsResponseSheet(doc: DocxDocument, meta: PaperMeta): ParsedPaper {
  const assets = new AssetRegistry(meta.paperId, doc);
  const records = splitRecords(doc.elements);

  const questions = records.map((rec, i) => buildQuestion(rec, i + 1, meta, assets));

  const usedAssets = assets.assets();
  const sectionsOrder = dedupeSections(questions.map((q) => q.section));
  const stats = computeStats(questions, usedAssets.length);

  return {
    ...meta,
    sectionsOrder: sectionsOrder.length ? sectionsOrder : SSC_CGL_TIER1_SECTIONS,
    questions,
    assets: usedAssets,
    stats,
  };
}

function dedupeSections(sections: ExamSection[]): ExamSection[] {
  const seen = new Set<ExamSection>();
  const out: ExamSection[] = [];
  for (const s of sections) {
    if (!seen.has(s)) {
      seen.add(s);
      out.push(s);
    }
  }
  return out;
}
