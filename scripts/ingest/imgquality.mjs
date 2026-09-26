// Compute quality metrics for every cached image so we can flag blurry / badly-cropped ones.
// Usage: node scripts/ingest/imgquality.mjs <workDir>
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const workDir = process.argv[2];
const imgDir = path.join(workDir, 'imgcache');
const manifest = JSON.parse(fs.readFileSync(path.join(workDir, 'manifest.json'), 'utf8'));

// map file -> {role, displayW, paper_name, qn, section, correct, optKey}
const info = new Map();
for (const q of manifest) {
  for (const s of q.stem_images) info.set(s.file, { role: 'figure', displayW: 470, paper: q.paper_name, paper_id: q.paper_id, qn: q.qn, section: q.section, correct: q.correct_option, optKey: null, year: q.year });
  for (const o of q.options) if (o.isImage && o.file) info.set(o.file, { role: 'option', displayW: 210, paper: q.paper_name, paper_id: q.paper_id, qn: q.qn, section: q.section, correct: q.correct_option, optKey: o.key, year: q.year });
}

const files = [...info.keys()];
const out = [];
let i = 0;
for (const f of files) {
  const p = path.join(imgDir, f);
  const meta = info.get(f);
  try {
    let buf = fs.readFileSync(p);
    if (f.toLowerCase().endsWith('.svg')) { out.push({ file: f, ...meta, svg: true }); continue; }
    const m = await sharp(buf).metadata();
    const st = await sharp(buf).stats();
    // content bbox via trim (near-uniform border removal)
    let marginFrac = null, trimmedW = m.width, trimmedH = m.height;
    try {
      const t = await sharp(buf).trim({ threshold: 12 }).toBuffer({ resolveWithObject: true });
      trimmedW = t.info.width; trimmedH = t.info.height;
      const left = t.info.trimOffsetLeft ?? 0, top = t.info.trimOffsetTop ?? 0;
      const right = m.width - trimmedW - left, bottom = m.height - trimmedH - top;
      marginFrac = {
        left: +(left / m.width).toFixed(3), right: +(right / m.width).toFixed(3),
        top: +(top / m.height).toFixed(3), bottom: +(bottom / m.height).toFixed(3),
      };
    } catch { /* uniform image */ }
    const upscale = +(meta.displayW / m.width).toFixed(2); // >1 => enlarged in doc => soft
    out.push({
      file: f, ...meta, w: m.width, h: m.height,
      sharpness: +st.sharpness.toFixed(2), entropy: +st.entropy.toFixed(2),
      upscale, aspect: +(m.width / m.height).toFixed(2),
      contentW: trimmedW, contentH: trimmedH, margin: marginFrac,
    });
  } catch (e) {
    out.push({ file: f, ...meta, error: String(e.message || e) });
  }
  if (++i % 200 === 0) process.stdout.write(`\r${i}/${files.length}`);
}
fs.writeFileSync(path.join(workDir, 'quality.json'), JSON.stringify(out, null, 1));
console.log('\nwrote quality.json for', out.length, 'images');

// quick distribution summary
const png = out.filter((r) => !r.svg && !r.error);
const q = (arr, p) => { const s = [...arr].sort((a, b) => a - b); return s[Math.floor(p * (s.length - 1))]; };
const sh = png.map((r) => r.sharpness);
const up = png.map((r) => r.upscale);
const minDim = png.map((r) => Math.min(r.w, r.h));
console.log('sharpness  p05/p25/p50/p75:', q(sh, .05), q(sh, .25), q(sh, .5), q(sh, .75));
console.log('upscale    p50/p75/p90/p95:', q(up, .5), q(up, .75), q(up, .9), q(up, .95));
console.log('min-dim px p05/p10/p25/p50:', q(minDim, .05), q(minDim, .1), q(minDim, .25), q(minDim, .5));
console.log('svg (skipped):', out.filter((r) => r.svg).length, ' errors:', out.filter((r) => r.error).length);
