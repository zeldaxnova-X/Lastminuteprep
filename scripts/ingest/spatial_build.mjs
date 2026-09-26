// Build a DOCX catalogue of genuine spatial-reasoning figures for manual enhancement.
// Usage: node --max-old-space-size=6144 scripts/ingest/spatial_build.mjs <workDir> <outFile>
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { Document, Packer, Paragraph, TextRun, ImageRun, HeadingLevel, AlignmentType, BorderStyle, PageBreak, TableOfContents, ShadingType } from 'docx';

const work = process.argv[2], outFile = process.argv[3];
const imgDir = path.join(work, 'imgcache');
const manifest = JSON.parse(fs.readFileSync(path.join(work, 'manifest.json'), 'utf8'));
const NAVY = '1F3A5F', GREY = '777777', GREEN = '1B7F3B', PURPLE = '6B21A8';
const cache = new Map();
async function load(f) { if (cache.has(f)) return cache.get(f); const p = path.join(imgDir, f); if (!fs.existsSync(p)) { cache.set(f, null); return null; }
  let buf = fs.readFileSync(p); try { if (f.toLowerCase().endsWith('.svg')) { buf = await sharp(Buffer.from(buf.toString('utf8').replace(/&(?!(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/g, '&amp;')), { density: 180 }).png().toBuffer(); }
    const m = await sharp(buf).metadata(); const rec = { buf, w: m.width || 300, h: m.height || 200 }; cache.set(f, rec); return rec; } catch { cache.set(f, null); return null; } }
function dim(rec, maxW, maxH) { let { w, h } = rec, W = Math.min(w, maxW), H = W / w * h; if (maxH && H > maxH) { H = maxH; W = H / h * w; } return { width: Math.round(W), height: Math.round(H) }; }
async function imgP(f, mw, mh) { const r = await load(f); if (!r) return new Paragraph({ children: [new TextRun({ text: `[missing ${f}]`, color: 'B00020', italics: true, size: 16 })] }); return new Paragraph({ spacing: { before: 30, after: 16 }, children: [new ImageRun({ type: 'png', data: r.buf, transformation: dim(r, mw, mh) })] }); }
const cap = (t) => new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: t, color: GREY, size: 14, font: 'Consolas' })] });
const secName = (s) => ({ reasoning: 'Reasoning', general_awareness: 'General Awareness', quantitative_aptitude: 'Quantitative Aptitude', english_comprehension: 'English' }[s] || s);

const byType = {}; manifest.forEach((m) => byType[m.type] = (byType[m.type] || 0) + 1);
const children = [
  new Paragraph({ spacing: { before: 1500, after: 120 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'SSC CGL Tier-1 PYQ', bold: true, size: 52, color: NAVY })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 300 }, children: [new TextRun({ text: 'Genuine Spatial-Reasoning Figures', size: 30, color: NAVY })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [new TextRun({ text: `${manifest.length} questions — true images that cannot be recreated as text/SVG (mirror, rotation, dice, paper-folding, embedded, figure-series, counting).`, italics: true, size: 20, color: GREY })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 300 }, children: [new TextRun({ text: 'These are the figures for manual crop/enhancement. Each image caption is its source filename.', italics: true, size: 20, color: GREY })] }),
  new Paragraph({ children: [new PageBreak()] }),
  new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('Summary by figure type')] }),
];
for (const [t, n] of Object.entries(byType).sort((a, b) => b[1] - a[1])) children.push(new Paragraph({ spacing: { after: 20 }, children: [new TextRun({ text: `${String(n).padStart(3)}  `, bold: true, size: 22, color: PURPLE }), new TextRun({ text: t, size: 22 })] }));
children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 200 }, children: [new TextRun('Contents')] }), new TableOfContents('Contents', { hyperlink: true, headingStyleRange: '1-2' }), new Paragraph({ children: [new PageBreak()] }));

let curYear = null, curPaper = null;
for (const q of manifest) {
  if (q.year !== curYear) { curYear = q.year; curPaper = null; children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: true, children: [new TextRun(`${curYear} Papers`)] })); }
  if (q.paper_name !== curPaper) { curPaper = q.paper_name; children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 140, after: 40 }, children: [new TextRun(q.paper_name)] })); children.push(cap(`paper id: ${q.paper_id}`)); }
  children.push(new Paragraph({ spacing: { before: 120, after: 40 }, shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'F3EEFB' }, border: { left: { style: BorderStyle.SINGLE, size: 18, color: PURPLE, space: 6 } },
    children: [new TextRun({ text: `  Q${q.qn}`, bold: true, size: 24, color: NAVY }), new TextRun({ text: `   ${secName(q.section)}`, size: 20, color: '333333' }), new TextRun({ text: `    ${q.type}`, bold: true, size: 20, color: PURPLE }), new TextRun({ text: `    Correct: `, size: 20, color: '333333' }), new TextRun({ text: `${q.correct_option || '?'}`, bold: true, size: 22, color: GREEN })] }));
  if (q.stem_text && q.stem_text.trim()) children.push(new Paragraph({ spacing: { after: 30 }, children: [new TextRun({ text: q.stem_text.trim(), size: 20 })] }));
  for (const s of q.stem_images) { children.push(new Paragraph({ spacing: { before: 30 }, children: [new TextRun({ text: 'Figure:', bold: true, size: 18, color: GREY })] })); children.push(await imgP(s.file, 470, 430)); children.push(cap(s.file)); }
  const anyImg = q.options.some((o) => o.isImage && o.file);
  if (q.options.length) children.push(new Paragraph({ spacing: { before: 30, after: 16 }, children: [new TextRun({ text: 'Options:', bold: true, size: 18, color: GREY })] }));
  for (const o of q.options) { const ok = o.key === q.correct_option;
    if (o.isImage && o.file) { children.push(new Paragraph({ spacing: { before: 20 }, children: [new TextRun({ text: `(${o.key})${ok ? '  ✓ correct' : ''}`, bold: true, size: 20, color: ok ? GREEN : '333333' })] })); children.push(await imgP(o.file, 210, 210)); children.push(cap(o.file)); }
    else children.push(new Paragraph({ spacing: { after: 16 }, children: [new TextRun({ text: `(${o.key})  `, bold: true, size: 20, color: ok ? GREEN : '333333' }), new TextRun({ text: o.text || '', size: 20, color: ok ? GREEN : '333333', bold: ok }), new TextRun({ text: ok ? '  ✓' : '', bold: true, size: 18, color: GREEN })] }));
  }
  children.push(new Paragraph({ spacing: { before: 40, after: 40 }, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'DDDDDD', space: 1 } }, children: [new TextRun('')] }));
}
const doc = new Document({ creator: 'LastMilePrep', title: 'SSC CGL Genuine Spatial Figures', features: { updateFields: true },
  styles: { default: { document: { run: { font: 'Calibri', size: 21 } } }, paragraphStyles: [
    { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 32, bold: true, color: NAVY }, paragraph: { spacing: { before: 200, after: 100 } } },
    { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 25, bold: true, color: '2C5282' }, paragraph: { spacing: { before: 140, after: 60 } } } ] },
  sections: [{ properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1080, bottom: 1080, left: 1080, right: 1080 } } }, children }] });
fs.writeFileSync(outFile, await Packer.toBuffer(doc));
console.log('wrote', outFile, (fs.statSync(outFile).size / 1048576).toFixed(1), 'MB');
