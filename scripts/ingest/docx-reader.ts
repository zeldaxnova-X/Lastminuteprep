/**
 * Low-level DOCX reader.
 *
 * A .docx file is a ZIP of XML parts. Rather than convert to HTML (which loses
 * the precise ordering of figures relative to prose that our parsers depend
 * on), we walk `word/document.xml` in document order and emit a flat list of
 * `DocElement`s: paragraphs and tables, each carrying the ordered image
 * relationship ids that appeared inside them.
 *
 * Image relationship ids are resolved via `word/_rels/document.xml.rels` to the
 * concrete media entries, whose bytes are read straight from the zip.
 */
import { createHash } from "node:crypto";
import JSZip from "jszip";
import { readFile } from "node:fs/promises";
import type { RawAsset } from "./model";

export interface DocParagraph {
  type: "paragraph";
  index: number;
  text: string;
  /** Ordered relationship ids of images embedded in this paragraph. */
  imageRels: string[];
  /** Id of the enclosing table (if any); enables regrouping genuine tables. */
  tableId?: number;
}

export interface DocTable {
  type: "table";
  index: number;
  rows: string[][];
  imageRels: string[];
}

export type DocElement = DocParagraph | DocTable;

export interface DocxDocument {
  elements: DocElement[];
  /** relationship id -> media path inside the zip (e.g. "word/media/image3.png"). */
  relToMedia: Map<string, string>;
  /** media path -> raw bytes. */
  media: Map<string, Buffer>;
  /** Full concatenated plain text (used for header/metadata sniffing). */
  fullText: string;
}

const WS = / /g; // non-breaking space -> normal space

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&amp;/g, "&");
}

/** Extract ordered run text from a paragraph/cell XML fragment. */
function extractText(xml: string): string {
  // Strip paragraph/run properties so their attributes never leak into text.
  const stripped = xml.replace(/<w:pPr>[\s\S]*?<\/w:pPr>/g, "");
  const parts: string[] = [];
  const re = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>|<w:tab\b[^>]*\/>|<w:br\b[^>]*\/>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(stripped))) {
    if (m[1] !== undefined) parts.push(decodeXmlEntities(m[1]));
    else parts.push(" ");
  }
  return parts.join("").replace(WS, " ").replace(/[ \t]+/g, " ").trim();
}

/**
 * Extract ordered image relationship ids from a fragment (DrawingML + VML).
 *
 * DOCX wraps each image in `<mc:AlternateContent>` with a `<mc:Choice>`
 * (DrawingML `<a:blip>`) AND a `<mc:Fallback>` (VML `<v:imagedata>`) — the SAME
 * image in two formats. Extracting both double-counts every figure, so we strip
 * the Fallback first. Genuine standalone VML (in docs without AlternateContent)
 * is preserved because it isn't inside a Fallback block.
 */
function extractImageRels(xml: string): string[] {
  const withoutFallback = xml.replace(/<mc:Fallback>[\s\S]*?<\/mc:Fallback>/g, "");
  const rels: string[] = [];
  const re =
    /<a:blip\b[^>]*\br:embed="([^"]+)"|<a:blip\b[^>]*\br:link="([^"]+)"|<v:imagedata\b[^>]*\br:id="([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(withoutFallback))) {
    rels.push(m[1] || m[2] || m[3]);
  }
  return rels;
}

/**
 * Ordered scan of the document body as a flat paragraph stream.
 *
 * In these papers the "tables" are layout containers, and question content
 * lives in their cells. We therefore emit every `<w:p>` in true document order
 * (including those nested in tables), tagging each with the enclosing table id
 * so a parser can still regroup a genuine data table when it needs to.
 *
 * A single linear pass tracks `<w:tbl>` / `</w:tbl>` depth for table ids and
 * skips `<w:pPr>`-level false positives via a char-after-`<w:p` guard.
 */
function scanBody(bodyXml: string): DocElement[] {
  const elements: DocElement[] = [];
  const tokenRe = /<w:tbl\b|<\/w:tbl>|<w:p\b|<w:p\/>/g;
  const tableStack: number[] = [];
  let tableSeq = 0;
  let index = 0;
  let m: RegExpExecArray | null;

  while ((m = tokenRe.exec(bodyXml))) {
    const tok = m[0];
    const pos = m.index;

    if (tok === "<w:tbl") {
      tableStack.push(++tableSeq);
      continue;
    }
    if (tok === "</w:tbl>") {
      tableStack.pop();
      continue;
    }

    const tableId = tableStack.length ? tableStack[tableStack.length - 1] : undefined;

    if (tok === "<w:p/>") {
      elements.push({ type: "paragraph", index: index++, text: "", imageRels: [], tableId });
      continue;
    }

    // "<w:p" — guard against "<w:pPr"/"<w:pStyle" (next char must delimit a tag).
    const after = bodyXml[pos + 4];
    if (after !== " " && after !== ">" && after !== "\t" && after !== "\n" && after !== "\r" && after !== "/") {
      continue;
    }
    const end = bodyXml.indexOf("</w:p>", pos);
    if (end === -1) break;
    const frag = bodyXml.slice(pos, end + 6);
    elements.push({
      type: "paragraph",
      index: index++,
      text: extractText(frag),
      imageRels: extractImageRels(frag),
      tableId,
    });
    // Advance the regex past this paragraph so nested "<w:p" inside it aren't
    // re-tokenised (paragraphs don't nest, but runs/props won't false-match).
    tokenRe.lastIndex = end + 6;
  }
  return elements;
}

function parseRels(relsXml: string): Map<string, string> {
  const map = new Map<string, string>();
  const re = /<Relationship\b[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"[^>]*\/?>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(relsXml))) {
    const id = m[1];
    let target = m[2].replace(/\\/g, "/");
    if (target.startsWith("/")) target = target.slice(1);
    else if (!target.startsWith("word/") && !target.startsWith("http"))
      target = "word/" + target.replace(/^\.\//, "");
    map.set(id, target);
  }
  return map;
}

export async function readDocx(filePath: string): Promise<DocxDocument> {
  const buf = await readFile(filePath);
  const zip = await JSZip.loadAsync(buf);

  const docFile = zip.file("word/document.xml");
  if (!docFile) throw new Error(`Not a valid DOCX (missing word/document.xml): ${filePath}`);
  const documentXml = (await docFile.async("nodebuffer")).toString("utf8");

  const bodyStart = documentXml.indexOf("<w:body");
  const bodyXml = bodyStart === -1 ? documentXml : documentXml.slice(bodyStart);
  const elements = scanBody(bodyXml);

  const relsFile = zip.file("word/_rels/document.xml.rels");
  const relToMedia = relsFile
    ? parseRels((await relsFile.async("nodebuffer")).toString("utf8"))
    : new Map<string, string>();

  const media = new Map<string, Buffer>();
  await Promise.all(
    Object.keys(zip.files)
      .filter((name) => name.startsWith("word/media/"))
      .map(async (name) => {
        media.set(name, await zip.files[name].async("nodebuffer"));
      })
  );

  const fullText = elements
    .map((el) => (el.type === "paragraph" ? el.text : el.rows.map((r) => r.join(" ")).join("\n")))
    .join("\n");

  return { elements, relToMedia, media, fullText };
}

/**
 * Read pixel dimensions from a PNG or JPEG buffer header (no decoding). Used to
 * distinguish tiny UI glyphs (correctness ticks, radio icons) from real
 * figures. Returns null for unsupported/unknown formats.
 */
export function imageDimensions(buf: Buffer): { w: number; h: number } | null {
  // PNG: 8-byte signature, then IHDR with width/height at bytes 16..24.
  if (buf.length >= 24 && buf[0] === 0x89 && buf[1] === 0x50) {
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  }
  // JPEG: scan for a Start-Of-Frame marker (0xFFC0..0xFFC3, C5..C7, C9..CB).
  if (buf.length >= 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) { i++; continue; }
      const marker = buf[i + 1];
      const isSof =
        (marker >= 0xc0 && marker <= 0xc3) ||
        (marker >= 0xc5 && marker <= 0xc7) ||
        (marker >= 0xc9 && marker <= 0xcb);
      if (isSof) return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
      if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; }
      i += 2 + buf.readUInt16BE(i + 2);
    }
  }
  return null;
}

/**
 * Build a RawAsset for a resolved media path, computing a content hash so the
 * loader can dedupe identical images across papers.
 */
export function buildAsset(
  paperId: string,
  ordinal: number,
  mediaPath: string,
  bytes: Buffer
): RawAsset {
  const ext = (mediaPath.split(".").pop() || "png").toLowerCase();
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  return {
    id: `${paperId}__img${ordinal}`,
    mediaPath,
    ext,
    sha256,
    byteLength: bytes.length,
    bytes,
  };
}
