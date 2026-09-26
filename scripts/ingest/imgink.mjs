// Compute ink-coverage + aspect for every image to detect near-empty / sliver crops.
// Usage: node scripts/ingest/imgink.mjs <workDir>
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const workDir = process.argv[2];
const imgDir = path.join(workDir, 'imgcache');
const manifest = JSON.parse(fs.readFileSync(path.join(workDir, 'manifest.json'), 'utf8'));

const info = new Map();
for (const q of manifest) {
  for (const s of q.stem_images) info.set(s.file, { role: 'fig', paper: q.paper_name, paper_id: q.paper_id, qn: q.qn, correct: q.correct_option, optKey: null, year: q.year });
  for (const o of q.options) if (o.isImage && o.file) info.set(o.file, { role: 'opt', paper: q.paper_name, paper_id: q.paper_id, qn: q.qn, correct: q.correct_option, optKey: o.key, year: q.year });
}

const out = [];
let i = 0;
for (const [f, meta] of info) {
  const p = path.join(imgDir, f);
  try {
    let buf = fs.readFileSync(p);
    if (f.toLowerCase().endsWith('.svg')) { out.push({ file: f, ...meta, svg: true }); continue; }
    const m = await sharp(buf).metadata();
    // downscale to a fixed grid, grayscale, count dark pixels
    const G = 256;
    const raw = await sharp(buf).flatten({ background: '#ffffff' }).grayscale().resize(G, G, { fit: 'fill' }).raw().toBuffer();
    let dark = 0;
    for (let k = 0; k < raw.length; k++) if (raw[k] < 160) dark++;
    const inkFrac = dark / raw.length;
    // content bbox on the resized grid (rows/cols containing any dark pixel)
    let minx = G, miny = G, maxx = -1, maxy = -1;
    for (let y = 0; y < G; y++) for (let x = 0; x < G; x++) {
      if (raw[y * G + x] < 160) { if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y; }
    }
    const bboxFrac = maxx < 0 ? 0 : ((maxx - minx + 1) * (maxy - miny + 1)) / (G * G);
    out.push({ file: f, ...meta, w: m.width, h: m.height, aspect: +(m.width / m.height).toFixed(2), inkFrac: +inkFrac.toFixed(4), bboxFrac: +bboxFrac.toFixed(3) });
  } catch (e) { out.push({ file: f, ...meta, error: String(e.message || e) }); }
  if (++i % 200 === 0) process.stdout.write(`\r${i}`);
}
fs.writeFileSync(path.join(workDir, 'ink.json'), JSON.stringify(out, null, 1));
const png = out.filter((r) => !r.svg && !r.error);
const qtl = (arr, p) => { const s = [...arr].sort((a, b) => a - b); return s[Math.floor(p * (s.length - 1))]; };
const ink = png.map((r) => r.inkFrac);
console.log('\nink p02/p05/p10/p25/p50:', qtl(ink, .02), qtl(ink, .05), qtl(ink, .1), qtl(ink, .25), qtl(ink, .5));
console.log('lowest-ink 40:');
for (const r of [...png].sort((a, b) => a.inkFrac - b.inkFrac).slice(0, 40))
  console.log(`  ink=${r.inkFrac} bbox=${r.bboxFrac} aspect=${r.aspect} ${r.w}x${r.h}  ${r.file}  ${r.paper} Q${r.qn} ${r.role}${r.optKey || ''}`);
