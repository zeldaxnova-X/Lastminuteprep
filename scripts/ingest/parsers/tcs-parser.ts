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
 *
 * Two source quirks are handled architecturally so no per-question patching is
 * ever required:
 *   1. Decorative glyphs (a red ✗ icon, publisher watermarks, radio glyphs) are
 *      embedded in many questions. A genuine figure belongs to exactly one
 *      question, so any media referenced by >1 question is treated as chrome and
 *      excluded (see `decorativeRelIds`).
 *   2. Multiple options can share a single paragraph, e.g. "1. a  2. b". Options
 *      are split on inline numeric markers, not on paragraph boundaries.
 */
import { AssetRegistry } from "../assets";
import { imageDimensions } from "../docx-reader";
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
/** "Ans " immediately before the first option marker (kept, not consumed). */
const RE_ANS_INLINE = /\bAns\s+(?=[1-4]\s*[.)])/i;
/** Standalone answer marker: a paragraph that is just "Ans". */
const RE_ANS_STANDALONE = /^Ans\s*$/i;
/** Leading numeric option marker at the start of a piece, e.g. "2." or "3)". */
const RE_OPTION_START = /^\s*(\d)\s*[.)]\s*/;
/**
 * Inline option marker: a 1-4 digit preceded by start/whitespace, a period, and
 * followed by whitespace. Period-only + lookahead avoids false positives such as
 * the ")" in "(33, 11, 3)" being read as an option marker.
 */
const RE_INLINE_MARKER = /(^|\s)([1-4])\.(?=\s)/g;

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

  // Drop the TCS candidate/exam header block that precedes the first question.
  const start = firstQuestionIndex(elements);

  for (let i = start; i < elements.length; i++) {
    const el = elements[i];
    if (el.type !== "paragraph") {
      const text = el.rows.map((r) => r.join("  ")).join("\n");
      buffer.push({ type: "paragraph", index: el.index, text, imageRels: el.imageRels });
      continue;
    }

    const maybeSection = matchSectionHeader(el.text);
    if (maybeSection) {
      section = maybeSection;
      continue;
    }

    // Start of the metadata delimiter => close the current question. Scan
    // forward past known label/blank lines, capturing Status/Chosen Option,
    // until real content or the next Question ID.
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
        if (RE_QUESTION_ID.test(tx)) break;
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
        break;
      }

      records.push({ content: buffer, externalId, status, chosen, section });
      buffer = [];
      i = j - 1;
      continue;
    }

    buffer.push(el);
  }

  return records;
}

/** A paragraph carries content if it has text or a (non-decorative) image. */
function hasContent(p: DocParagraph): boolean {
  return p.text.trim() !== "" || p.imageRels.length > 0;
}

/**
 * Split any paragraph containing more than one inline option marker into one
 * paragraph per option, e.g. "1. a  2. b" → ["1. a", "2. b"]. Single-marker or
 * marker-less paragraphs pass through unchanged (their images are preserved).
 */
function explodeInlineOptions(paras: DocParagraph[]): DocParagraph[] {
  const out: DocParagraph[] = [];
  for (const p of paras) {
    const text = p.text;
    RE_INLINE_MARKER.lastIndex = 0;
    const marks: { start: number; num: string; contentStart: number }[] = [];
    let m: RegExpExecArray | null;
    while ((m = RE_INLINE_MARKER.exec(text))) {
      // start = position of the digit; content begins after "N.".
      marks.push({ start: m.index + m[1].length, num: m[2], contentStart: m.index + m[1].length + 2 });
    }
    if (marks.length <= 1) {
      out.push(p);
      continue;
    }
    // Multiple markers in one paragraph: split. (Such paragraphs are textual;
    // any images stay with the pre-marker remnant / first piece.)
    const pre = text.slice(0, marks[0].start).trim();
    let imagesAttached = false;
    if (pre) {
      out.push({ ...p, text: pre });
      imagesAttached = true;
    }
    for (let k = 0; k < marks.length; k++) {
      const end = k + 1 < marks.length ? marks[k + 1].start : text.length;
      const seg = text.slice(marks[k].contentStart, end).trim();
      out.push({
        type: "paragraph",
        index: p.index,
        text: `${marks[k].num}. ${seg}`.trim(),
        imageRels: imagesAttached ? [] : p.imageRels,
      });
      imagesAttached = true;
    }
  }
  return out;
}

/**
 * Split a question's content paragraphs into stem vs the four options, handling
 * inline option-1 fusion, image options, and options that share a paragraph.
 */
function splitStemAndOptions(paras: DocParagraph[]): {
  stem: DocParagraph[];
  optionGroups: DocParagraph[][];
  /** Ordered region paragraphs for image assignment (handles anchor offset). */
  regionForImages: DocParagraph[];
  warnings: string[];
} {
  const warnings: string[] = [];

  // 1) Locate the answer marker.
  let markerIdx = -1;
  let inline: { stemHead: string; optText: string } | null = null;
  for (let i = 0; i < paras.length; i++) {
    const inlineMatch = RE_ANS_INLINE.exec(paras[i].text);
    if (inlineMatch) {
      markerIdx = i;
      inline = {
        stemHead: paras[i].text.slice(0, inlineMatch.index).trim(),
        // Keep the "1." marker so inline splitting can find every option.
        optText: paras[i].text.slice(inlineMatch.index + inlineMatch[0].length).trim(),
      };
      break;
    }
    if (RE_ANS_STANDALONE.test(paras[i].text)) {
      markerIdx = i;
      break;
    }
  }

  let impliedStart = false;
  if (markerIdx === -1) {
    markerIdx = paras.findIndex((p) => /^\s*1\s*[.)]/.test(p.text));
    impliedStart = markerIdx !== -1;
    if (markerIdx === -1) {
      warnings.push("no-ans-marker");
      return { stem: paras, optionGroups: [], regionForImages: [], warnings };
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
      stem.push({ ...marker, text: "", imageRels: marker.imageRels });
      optionRegion.push({ ...marker, text: inline.optText, imageRels: [] });
    } else {
      optionRegion.push({ ...marker, text: inline.optText });
    }
    optionRegion.push(...paras.slice(markerIdx + 1));
  } else if (impliedStart) {
    optionRegion.push(...paras.slice(markerIdx));
  } else {
    optionRegion.push(...paras.slice(markerIdx + 1));
  }

  // 3) Explode inline multi-option paragraphs, then group into options.
  const content = explodeInlineOptions(optionRegion).filter(hasContent);

  const explicitlyNumbered =
    content.filter((p) => /^\s*[2-4]\s*[.)]/.test(p.text)).length >= 2;

  const groups: DocParagraph[][] = [];
  if (explicitlyNumbered) {
    let current: DocParagraph[] | null = null;
    for (const p of content) {
      if (RE_OPTION_START.test(p.text)) {
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

  // Region used for order-based image assignment. In the standalone-"Ans"
  // layout the marker paragraph itself can carry option 1's figure (the drawing
  // anchors one paragraph early), so include it.
  const regionForImages: DocParagraph[] = [...optionRegion];
  if (!inline && !impliedStart && marker.imageRels.length > 0) {
    regionForImages.unshift({ ...marker, text: "", imageRels: marker.imageRels });
  }

  if (groups.length > 4) warnings.push(`option-overflow=${groups.length}`);
  if (groups.length < 4) warnings.push(`option-count=${groups.length}`);
  return { stem, optionGroups: groups.slice(0, 4), regionForImages, warnings };
}

/**
 * Convert paragraphs into ordered content blocks, skipping decorative images
 * and de-duplicating repeated images within the group.
 */
function paragraphsToBlocks(
  paras: DocParagraph[],
  assets: AssetRegistry,
  decorativeRelIds: Set<string>
): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  const seen = new Set<string>();
  for (const p of paras) {
    if (p.text) blocks.push({ kind: "text", text: p.text });
    for (const rel of p.imageRels) {
      if (decorativeRelIds.has(rel)) continue;
      const assetId = assets.resolve(rel);
      if (assetId && !seen.has(assetId)) {
        seen.add(assetId);
        blocks.push({ kind: "image", assetId });
      }
    }
  }
  return blocks;
}

function buildQuestion(
  rec: RawRecord,
  qNumber: number,
  meta: PaperMeta,
  assets: AssetRegistry,
  decorativeRelIds: Set<string>
): ParsedQuestion {
  const warnings: string[] = [];

  // Strip a leading "Q.N" prefix from the first paragraph that carries text.
  const content = rec.content.map((p) => ({ ...p }));
  const firstTextIdx = content.findIndex((p) => p.text.trim() !== "");
  if (firstTextIdx !== -1 && RE_QNUM_PREFIX.test(content[firstTextIdx].text)) {
    content[firstTextIdx].text = content[firstTextIdx].text.replace(RE_QNUM_PREFIX, "");
  }

  const { stem, optionGroups, regionForImages, warnings: splitWarnings } =
    splitStemAndOptions(content);
  warnings.push(...splitWarnings);

  // Remove a dangling "Ans" left on the stem when option 1 is an image.
  for (let i = stem.length - 1; i >= 0; i--) {
    if (stem[i].text.trim() === "") continue;
    stem[i] = { ...stem[i], text: stem[i].text.replace(/\s*\bAns\s*$/i, "").trim() };
    break;
  }

  let stemBlocks = paragraphsToBlocks(stem, assets, decorativeRelIds);
  const options: ParsedOption[] = optionGroups.map((group, i) => {
    const key = optionKeyFromIndex(i + 1) as OptionKey;
    const flatText = group
      .map((p) => p.text.trim())
      .filter(Boolean)
      .join("\n")
      .trim();

    // Text option: text-only (line images are chrome). Image option: figures,
    // with decorative glyphs excluded and duplicates removed.
    if (flatText) {
      const blocks: ContentBlock[] = group
        .filter((p) => p.text.trim())
        .map((p) => ({ kind: "text", text: p.text.trim() }));
      return { key, index: i + 1, blocks, text: flatText, isImage: false };
    }
    const blocks: ContentBlock[] = [];
    const seen = new Set<string>();
    for (const p of group)
      for (const rel of p.imageRels) {
        if (decorativeRelIds.has(rel)) continue;
        const assetId = assets.resolve(rel);
        if (assetId && !seen.has(assetId)) {
          seen.add(assetId);
          blocks.push({ kind: "image", assetId });
        }
      }
    return { key, index: i + 1, blocks, text: "", isImage: blocks.length > 0 };
  });

  // Image-option offset correction. Figures frequently anchor to an adjacent
  // paragraph rather than their "N." marker line (sometimes even onto a stem
  // line). Rather than trust per-paragraph anchoring, gather every
  // non-decorative figure across the whole question in document order and treat
  // the LAST N as the N options (N = marker count); anything earlier is stem.
  const isImageOptionQuestion =
    options.length > 0 && options.every((o) => o.text.trim() === "");
  if (isImageOptionQuestion) {
    void regionForImages;
    const allImages: string[] = [];
    const seenAll = new Set<string>();
    for (const p of content)
      for (const rel of p.imageRels) {
        if (decorativeRelIds.has(rel)) continue;
        const assetId = assets.resolve(rel);
        if (assetId && !seenAll.has(assetId)) {
          seenAll.add(assetId);
          allImages.push(assetId);
        }
      }
    const n = options.length;
    if (allImages.length >= n) {
      const optionIds = allImages.slice(allImages.length - n);
      const stemIds = allImages.slice(0, allImages.length - n);
      const stemText = stemBlocks.filter((b) => b.kind !== "image");
      stemBlocks = [...stemText, ...stemIds.map((id) => ({ kind: "image" as const, assetId: id }))];
      options.forEach((o, i) => {
        o.blocks = [{ kind: "image", assetId: optionIds[i] }];
        o.isImage = true;
      });
    } else {
      warnings.push(`image-option-count=${allImages.length}/${n}`);
    }
  }

  const hasImages =
    stemBlocks.some((b) => b.kind === "image") || options.some((o) => o.isImage);

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

/** Small glyphs (correctness ticks, radio icons) are at most this many px. */
const GLYPH_MAX_DIM = 40;

/**
 * Identify decorative media (glyphs / watermarks / logos) so they are never
 * rendered as question content. Two content-driven, generalisable signals:
 *
 *   1. Shared media: a genuine figure belongs to exactly one question, so any
 *      media file referenced by >1 question is chrome (e.g. a red ✗ reused via
 *      one relationship, or a publisher watermark).
 *   2. Recurring small glyphs: correctness ticks are re-encoded per question
 *      (unique bytes, so signal 1 misses them) but share exact tiny pixel
 *      dimensions. A small image whose exact (w×h) recurs across ≥3 questions is
 *      a glyph. Genuine small images (e.g. a "√3" option) have varied
 *      dimensions that rarely recur, so they are kept.
 */
function findDecorativeRelIds(records: RawRecord[], doc: DocxDocument): Set<string> {
  const mediaToQuestions = new Map<string, Set<number>>();
  const dimToQuestions = new Map<string, Set<number>>();
  const mediaDimKey = new Map<string, string | null>();

  const dimKeyOf = (mp: string): string | null => {
    if (mediaDimKey.has(mp)) return mediaDimKey.get(mp)!;
    const bytes = doc.media.get("word/" + mp) ?? doc.media.get(mp);
    const dim = bytes ? imageDimensions(bytes) : null;
    const key = dim && dim.w <= GLYPH_MAX_DIM && dim.h <= GLYPH_MAX_DIM ? `${dim.w}x${dim.h}` : null;
    mediaDimKey.set(mp, key);
    return key;
  };

  records.forEach((rec, ri) => {
    const mediaInRec = new Set<string>();
    for (const p of rec.content)
      for (const rel of p.imageRels) {
        const mp = doc.relToMedia.get(rel);
        if (mp) mediaInRec.add(mp);
      }
    for (const mp of mediaInRec) {
      if (!mediaToQuestions.has(mp)) mediaToQuestions.set(mp, new Set());
      mediaToQuestions.get(mp)!.add(ri);
      const dk = dimKeyOf(mp);
      if (dk) {
        if (!dimToQuestions.has(dk)) dimToQuestions.set(dk, new Set());
        dimToQuestions.get(dk)!.add(ri);
      }
    }
  });

  const decorativeDims = new Set<string>();
  for (const [dk, qs] of dimToQuestions) if (qs.size >= 3) decorativeDims.add(dk);

  const decorativeMedia = new Set<string>();
  for (const [mp, qs] of mediaToQuestions) {
    if (qs.size >= 2) decorativeMedia.add(mp);
    else {
      const dk = mediaDimKey.get(mp);
      if (dk && decorativeDims.has(dk)) decorativeMedia.add(mp);
    }
  }

  const decorativeRelIds = new Set<string>();
  for (const [rel, mp] of doc.relToMedia) if (decorativeMedia.has(mp)) decorativeRelIds.add(rel);
  return decorativeRelIds;
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
  const decorativeRelIds = findDecorativeRelIds(records, doc);

  const questions = records.map((rec, i) =>
    buildQuestion(rec, i + 1, meta, assets, decorativeRelIds)
  );

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
