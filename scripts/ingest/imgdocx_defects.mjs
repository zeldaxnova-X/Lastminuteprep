// Build a DOCX of ONLY the image assets that need re-cropping / de-blurring,
// each tagged with paper, question, option, correct answer, and the defect type.
// Usage: node --max-old-space-size=6144 scripts/ingest/imgdocx_defects.mjs <workDir> <outFile>
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import {
  Document, Packer, Paragraph, TextRun, ImageRun, HeadingLevel, AlignmentType,
  BorderStyle, PageBreak, TableOfContents, ShadingType,
} from 'docx';

const workDir = process.argv[2];
const outFile = process.argv[3];
const imgDir = path.join(workDir, 'imgcache');
const manifest = JSON.parse(fs.readFileSync(path.join(workDir, 'manifest.json'), 'utf8'));
const cropFlags = JSON.parse(fs.readFileSync(path.join(workDir, 'crop_flags.json'), 'utf8'));

// file -> defect reason
const defect = new Map();
for (const r of cropFlags) defect.set(r.file, r.reason); // 'sliver crop' | 'near-empty' | 'corner fragment'
// visually-confirmed blur / cut-off / faint (not caught by ink metric)
const visual = {
  'ssc-cgl-tier-1-2022-2022-12-01-shift-1__q5_fig.png': 'blurry / pixelated',
  'ssc-cgl-tier-1-2022-2022-12-02-shift-4__q15_opt1.png': 'blurry',
  'ssc-cgl-tier-1-2022-2022-12-02-shift-4__q15_opt2.png': 'blurry',
  'ssc-cgl-tier-1-2022-2022-12-02-shift-4__q15_opt3.png': 'blurry',
  'ssc-cgl-tier-1-2022-2022-12-02-shift-4__q15_opt4.png': 'blurry',
  'ssc-cgl-tier-1-2024-2024-09-25-shift-3__q47_fig.png': 'blurry / smudged',
  'ssc-cgl-tier-1-2022-2022-12-01-shift-4__q10_opt1.png': 'cut off / partial',
  'ssc-cgl-tier-1-2022-2022-12-01-shift-4__q10_opt2.png': 'cut off / partial',
  'ssc-cgl-tier-1-2022-2022-12-01-shift-4__q10_opt3.png': 'cut off / partial',
  'ssc-cgl-tier-1-2022-2022-12-01-shift-4__q10_opt4.png': 'cut off / partial',
  'ssc-cgl-tier-1-2022-2022-12-03-shift-1__q2_opt1.png': 'cut off / partial',
  'ssc-cgl-tier-1-2024-2024-09-09-shift-1__q19_opt4.png': 'faint / cut off',
};
for (const [f, r] of Object.entries(visual)) if (!defect.has(f)) defect.set(f, r);

const GREEN = '1B7F3B', GREY = '777777', NAVY = '1F3A5F', RED = 'B00020';
const cache = new Map();
async function loadImg(file) {
  if (cache.has(file)) return cache.get(file);
  const p = path.join(imgDir, file);
  if (!fs.existsSync(p)) { cache.set(file, null); return null; }
  let buf = fs.readFileSync(p);
  try {
    if (file.toLowerCase().endsWith('.svg')) {
      const svg = buf.toString('utf8').replace(/&(?!(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/g, '&amp;');
      buf = await sharp(Buffer.from(svg), { density: 200 }).png().toBuffer();
    }
    const meta = await sharp(buf).metadata();
    const rec = { buf, w: meta.width || 400, h: meta.height || 300 };
    cache.set(file, rec); return rec;
  } catch { cache.set(file, null); return null; }
}
function scaled(rec, maxW, maxH) {
  let { w, h } = rec; let W = Math.min(w, maxW); let H = (W / w) * h;
  if (maxH && H > maxH) { H = maxH; W = (H / h) * w; }
  return { width: Math.round(W), height: Math.round(H) };
}
async function imagePara(file, maxW, maxH) {
  const rec = await loadImg(file);
  if (!rec) return new Paragraph({ children: [new TextRun({ text: `[missing ${file}]`, color: RED, italics: true, size: 16 })] });
  return new Paragraph({ spacing: { before: 40, after: 20 }, children: [new ImageRun({ type: 'png', data: rec.buf, transformation: scaled(rec, maxW, maxH) })] });
}
const caption = (t, c = GREY) => new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: t, color: c, size: 14, font: 'Consolas' })] });
const secName = (s) => ({ reasoning: 'Reasoning', general_awareness: 'General Awareness', quantitative_aptitude: 'Quantitative Aptitude', english_comprehension: 'English' }[s] || s);

// Gather flagged images grouped by question (manifest order)
const children = [];
let total = 0, byReason = {}, byYear = {};

children.push(
  new Paragraph({ spacing: { before: 1400, after: 120 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'SSC CGL Tier-1 PYQ', bold: true, size: 52, color: NAVY })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 300 }, children: [new TextRun({ text: 'Image Assets Needing Re-crop / De-blur', size: 30, color: NAVY })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [new TextRun({ text: 'Only the flagged images are included — those with improper cropping (near-empty / sliver / cut-off crops) or that are blurry.', italics: true, size: 20, color: GREY })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 300 }, children: [new TextRun({ text: 'Each image is tagged with its paper, question, option, the correct answer, and the detected defect. Caption = source filename.', italics: true, size: 20, color: GREY })] }),
);
const summaryIdx = children.push(new Paragraph({ children: [new PageBreak()] })) - 1;
children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('Contents')] }),
  new TableOfContents('Contents', { hyperlink: true, headingStyleRange: '1-2' }),
  new Paragraph({ children: [new PageBreak()] }));

let curYear = null, curPaper = null;
for (const q of manifest) {
  const flaggedStem = q.stem_images.filter((s) => defect.has(s.file));
  const flaggedOpts = q.options.filter((o) => o.isImage && o.file && defect.has(o.file));
  if (!flaggedStem.length && !flaggedOpts.length) continue;

  if (q.year !== curYear) { curYear = q.year; curPaper = null; children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: true, spacing: { before: 120, after: 80 }, children: [new TextRun(`${curYear} Papers`)] })); }
  if (q.paper_name !== curPaper) { curPaper = q.paper_name; children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 140, after: 40 }, children: [new TextRun(q.paper_name)] })); children.push(caption(`paper id: ${q.paper_id}`)); }

  children.push(new Paragraph({
    spacing: { before: 120, after: 40 }, shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'FBEEEE' },
    border: { left: { style: BorderStyle.SINGLE, size: 18, color: RED, space: 6 } },
    children: [
      new TextRun({ text: `  Q${q.qn}`, bold: true, size: 24, color: NAVY }),
      new TextRun({ text: `   ${secName(q.section)}`, size: 20, color: '333333' }),
      new TextRun({ text: `    Correct: `, size: 20, color: '333333' }),
      new TextRun({ text: `${q.correct_option || '?'}`, bold: true, size: 22, color: GREEN }),
    ],
  }));
  if (q.stem_text && q.stem_text.trim()) children.push(new Paragraph({ spacing: { after: 30 }, children: [new TextRun({ text: q.stem_text.trim(), size: 20 })] }));

  for (const s of flaggedStem) {
    const r = defect.get(s.file); byReason[r] = (byReason[r] || 0) + 1; total++; byYear[q.year] = (byYear[q.year] || 0) + 1;
    children.push(new Paragraph({ spacing: { before: 40 }, children: [new TextRun({ text: 'Stem figure', bold: true, size: 18, color: NAVY }), new TextRun({ text: `   ⚠ ${r}`, bold: true, size: 18, color: RED })] }));
    children.push(await imagePara(s.file, 470, 430));
    children.push(caption(s.file));
  }
  for (const o of flaggedOpts) {
    const r = defect.get(o.file); byReason[r] = (byReason[r] || 0) + 1; total++; byYear[q.year] = (byYear[q.year] || 0) + 1;
    const isCorrect = o.key === q.correct_option;
    children.push(new Paragraph({ spacing: { before: 40 }, children: [
      new TextRun({ text: `Option (${o.key})`, bold: true, size: 18, color: isCorrect ? GREEN : NAVY }),
      new TextRun({ text: isCorrect ? '  ✓ correct' : '', bold: true, size: 16, color: GREEN }),
      new TextRun({ text: `    ⚠ ${r}`, bold: true, size: 18, color: RED }),
    ] }));
    children.push(await imagePara(o.file, 300, 300));
    children.push(caption(o.file));
  }
  children.push(new Paragraph({ spacing: { before: 40, after: 40 }, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'DDDDDD', space: 1 } }, children: [new TextRun('')] }));
}

// summary block after title
const summary = [
  new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('Summary')] }),
  new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: `${total} flagged images`, bold: true, size: 24, color: RED })] }),
  new Paragraph({ children: [new TextRun({ text: 'By defect: ' + Object.entries(byReason).map(([k, v]) => `${k} — ${v}`).join(';  '), size: 20 })] }),
  new Paragraph({ children: [new TextRun({ text: 'By year: ' + Object.entries(byYear).sort().map(([k, v]) => `${k} — ${v}`).join(';  '), size: 20 })] }),
];
children.splice(summaryIdx + 1, 0, ...summary);

const doc = new Document({
  creator: 'LastMilePrep', title: 'SSC CGL Image Assets Needing Enhancement', features: { updateFields: true },
  styles: { default: { document: { run: { font: 'Calibri', size: 21 } } }, paragraphStyles: [
    { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 32, bold: true, color: NAVY }, paragraph: { spacing: { before: 200, after: 100 } } },
    { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 25, bold: true, color: '2C5282' }, paragraph: { spacing: { before: 140, after: 60 } } },
  ] },
  sections: [{ properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1080, bottom: 1080, left: 1080, right: 1080 } } }, children }],
});
const buf = await Packer.toBuffer(doc);
fs.writeFileSync(outFile, buf);
console.log('total flagged:', total, JSON.stringify(byReason), JSON.stringify(byYear));
console.log('wrote', outFile, (buf.length / 1048576).toFixed(1), 'MB');
