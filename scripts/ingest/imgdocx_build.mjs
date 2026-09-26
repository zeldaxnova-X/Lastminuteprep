// Build a tagged DOCX catalogue of every image question for enhancement work.
// Usage: node --max-old-space-size=6144 scripts/ingest/imgdocx_build.mjs <workDir> <outFile>
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import {
  Document, Packer, Paragraph, TextRun, ImageRun, HeadingLevel, AlignmentType,
  BorderStyle, PageBreak, TableOfContents, ShadingType, PageOrientation,
} from 'docx';

const workDir = process.argv[2];
const outFile = process.argv[3];
const imgDir = path.join(workDir, 'imgcache');
const manifest = JSON.parse(fs.readFileSync(path.join(workDir, 'manifest.json'), 'utf8'));

const GREEN = '1B7F3B';
const GREY = '777777';
const NAVY = '1F3A5F';

// image cache: file -> { buf(png), w, h }
const cache = new Map();
async function loadImg(file) {
  if (cache.has(file)) return cache.get(file);
  const p = path.join(imgDir, file);
  if (!fs.existsSync(p)) { cache.set(file, null); return null; }
  let buf = fs.readFileSync(p);
  let meta;
  try {
    if (file.toLowerCase().endsWith('.svg')) {
      // Repair raw & that isn't a valid XML entity (browsers tolerate it, strict parsers don't).
      const svg = buf.toString('utf8').replace(/&(?!(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/g, '&amp;');
      buf = await sharp(Buffer.from(svg, 'utf8'), { density: 200 }).png().toBuffer();
      meta = await sharp(buf).metadata();
    } else {
      meta = await sharp(buf).metadata();
    }
  } catch (e) {
    cache.set(file, null); return null;
  }
  const rec = { buf, w: meta.width || 400, h: meta.height || 300 };
  cache.set(file, rec);
  return rec;
}

function scaled(rec, maxW, maxH) {
  let { w, h } = rec;
  let W = Math.min(w, maxW);
  let H = (W / w) * h;
  if (maxH && H > maxH) { H = maxH; W = (H / h) * w; }
  return { width: Math.round(W), height: Math.round(H) };
}

async function imagePara(file, maxW, maxH, align = AlignmentType.LEFT) {
  const rec = await loadImg(file);
  if (!rec) return new Paragraph({ children: [new TextRun({ text: `[missing image: ${file}]`, color: 'B00020', italics: true, size: 16 })] });
  const dim = scaled(rec, maxW, maxH);
  return new Paragraph({
    alignment: align,
    spacing: { before: 40, after: 20 },
    children: [new ImageRun({ type: 'png', data: rec.buf, transformation: dim })],
  });
}
const caption = (t) => new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: t, color: GREY, size: 14, font: 'Consolas' })] });

const secName = (s) => ({
  reasoning: 'Reasoning', general_awareness: 'General Awareness',
  quantitative_aptitude: 'Quantitative Aptitude', english_comprehension: 'English',
}[s] || s);

const children = [];

// ---- Title ----
children.push(
  new Paragraph({ spacing: { before: 1600, after: 120 }, alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: 'SSC CGL Tier-1 PYQ', bold: true, size: 56, color: NAVY })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 400 },
    children: [new TextRun({ text: 'Image-Question Catalogue for Enhancement', size: 32, color: NAVY })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 },
    children: [new TextRun({ text: `${manifest.length} image questions across all papers (2022–2024)`, size: 22 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 },
    children: [new TextRun({ text: 'Each figure and option image is tagged with its paper, question number, section, and the correct answer.', italics: true, size: 20, color: GREY })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 400 },
    children: [new TextRun({ text: 'Full-resolution images are embedded; the caption under each image is its source filename.', italics: true, size: 20, color: GREY })] }),
  new Paragraph({ children: [new PageBreak()] }),
);

// ---- TOC ----
children.push(
  new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('Contents')] }),
  new TableOfContents('Contents', { hyperlink: true, headingStyleRange: '1-2' }),
  new Paragraph({ children: [new PageBreak()] }),
);

let curYear = null, curPaper = null;
let qIndexInPaper = 0;

for (const q of manifest) {
  if (q.year !== curYear) {
    curYear = q.year; curPaper = null;
    children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 200, after: 80 },
      pageBreakBefore: true, children: [new TextRun(`${curYear} Papers`)] }));
  }
  if (q.paper_name !== curPaper) {
    curPaper = q.paper_name; qIndexInPaper = 0;
    children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 160, after: 60 },
      pageBreakBefore: true, children: [new TextRun(q.paper_name)] }));
    children.push(caption(`paper id: ${q.paper_id}`));
  }
  qIndexInPaper++;

  // question header (shaded)
  children.push(new Paragraph({
    spacing: { before: 160, after: 40 },
    shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'EEF2F7' },
    border: { left: { style: BorderStyle.SINGLE, size: 18, color: NAVY, space: 6 } },
    children: [
      new TextRun({ text: `  Q${q.qn}`, bold: true, size: 26, color: NAVY }),
      new TextRun({ text: `    ${secName(q.section)}`, size: 22, color: '333333' }),
      new TextRun({ text: `        Correct answer: `, size: 22, color: '333333' }),
      new TextRun({ text: `${q.correct_option || '?'}`, bold: true, size: 24, color: GREEN }),
    ],
  }));

  // stem text
  if (q.stem_text && q.stem_text.trim()) {
    children.push(new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: q.stem_text.trim(), size: 21 })] }));
  }

  // stem figure(s)
  for (const s of q.stem_images) {
    children.push(new Paragraph({ spacing: { before: 40 }, children: [new TextRun({ text: 'Figure:', bold: true, size: 18, color: GREY })] }));
    children.push(await imagePara(s.file, 470, 430));
    children.push(caption(s.file));
  }

  // options
  const anyImg = q.options.some((o) => o.isImage && o.file);
  if (q.options.length) {
    children.push(new Paragraph({ spacing: { before: 40, after: 20 }, children: [new TextRun({ text: 'Options:', bold: true, size: 18, color: GREY })] }));
  }
  for (const o of q.options) {
    const isCorrect = o.key === q.correct_option;
    const tick = isCorrect ? '  ✓ correct' : '';
    if (o.isImage && o.file) {
      children.push(new Paragraph({
        spacing: { before: 30 },
        children: [new TextRun({ text: `(${o.key})${tick}`, bold: true, size: 20, color: isCorrect ? GREEN : '333333' })],
      }));
      children.push(await imagePara(o.file, 210, 210));
      children.push(caption(o.file));
    } else {
      children.push(new Paragraph({
        spacing: { after: 20 },
        children: [
          new TextRun({ text: `(${o.key})  `, bold: true, size: 20, color: isCorrect ? GREEN : '333333' }),
          new TextRun({ text: o.text || '', size: 20, color: isCorrect ? GREEN : '333333', bold: isCorrect }),
          new TextRun({ text: tick, bold: true, size: 18, color: GREEN }),
        ],
      }));
    }
  }

  // separator
  children.push(new Paragraph({
    spacing: { before: 60, after: 60 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'CCCCCC', space: 1 } },
    children: [new TextRun('')],
  }));
}

const doc = new Document({
  creator: 'LastMilePrep',
  title: 'SSC CGL Image-Question Catalogue',
  features: { updateFields: true },
  styles: {
    default: { document: { run: { font: 'Calibri', size: 21 } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 34, bold: true, color: NAVY }, paragraph: { spacing: { before: 240, after: 120 } } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 27, bold: true, color: '2C5282' }, paragraph: { spacing: { before: 160, after: 80 } } },
    ],
  },
  sections: [{
    properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1080, bottom: 1080, left: 1080, right: 1080 } } },
    children,
  }],
});

const buf = await Packer.toBuffer(doc);
fs.writeFileSync(outFile, buf);
console.log('wrote', outFile, (buf.length / 1048576).toFixed(1), 'MB');
