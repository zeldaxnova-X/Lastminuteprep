// Build labeled calibration montages of quality-suspect images.
// Usage: node scripts/ingest/imgmontage_cal.mjs <workDir>
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const workDir = process.argv[2];
const imgDir = path.join(workDir, 'imgcache');
const Q = JSON.parse(fs.readFileSync(path.join(workDir, 'quality.json'), 'utf8')).filter((r) => !r.svg && !r.error);

const CELL = 250, COLS = 6, PAD = 6, LABELH = 16;

async function montage(list, name) {
  const rows = Math.ceil(list.length / COLS);
  const W = COLS * (CELL + PAD) + PAD;
  const H = rows * (CELL + LABELH + PAD) + PAD;
  const composites = [];
  for (let i = 0; i < list.length; i++) {
    const r = list[i];
    const cx = PAD + (i % COLS) * (CELL + PAD);
    const cy = PAD + Math.floor(i / COLS) * (CELL + LABELH + PAD);
    try {
      const thumb = await sharp(path.join(imgDir, r.file))
        .flatten({ background: '#ffffff' })
        .resize(CELL, CELL, { fit: 'contain', background: '#ffffff' })
        .png().toBuffer();
      composites.push({ input: thumb, left: cx, top: cy + LABELH });
    } catch { /* skip */ }
    const label = `#${i}  sh${r.sharpness} ${r.w}x${r.h}`;
    const svg = Buffer.from(`<svg width="${CELL}" height="${LABELH}"><rect width="100%" height="100%" fill="#1F3A5F"/><text x="3" y="12" font-family="Arial" font-size="11" fill="#fff">${label}</text></svg>`);
    composites.push({ input: svg, left: cx, top: cy });
  }
  const canvas = sharp({ create: { width: W, height: H, channels: 3, background: '#dddddd' } });
  await canvas.composite(composites).png().toFile(path.join(workDir, name));
  console.log('wrote', name, list.length, 'cells');
  return list.map((r, i) => `#${i} ${r.file} | ${r.paper} Q${r.qn}${r.optKey ? ' opt' + r.optKey : ' fig'} | sh=${r.sharpness} up=${r.upscale} ${r.w}x${r.h} margin=${JSON.stringify(r.margin)}`);
}

// Candidate set A: lowest sharpness (36)
const bySharp = [...Q].sort((a, b) => a.sharpness - b.sharpness).slice(0, 36);
// Candidate set B: highest upscale (native too small for display) (24)
const byUp = [...Q].sort((a, b) => b.upscale - a.upscale).slice(0, 24);
// Candidate set C: crop suspects — largest total margin (loose crop) (24)
const totMargin = (r) => r.margin ? (r.margin.left + r.margin.right + r.margin.top + r.margin.bottom) : 0;
const byMargin = [...Q].sort((a, b) => totMargin(b) - totMargin(a)).slice(0, 24);

const mapA = await montage(bySharp, 'cal_A_sharp.png');
const mapB = await montage(byUp, 'cal_B_upscale.png');
const mapC = await montage(byMargin, 'cal_C_margin.png');
fs.writeFileSync(path.join(workDir, 'cal_maps.txt'),
  'SET A (lowest sharpness)\n' + mapA.join('\n') + '\n\nSET B (highest upscale)\n' + mapB.join('\n') + '\n\nSET C (largest margins)\n' + mapC.join('\n') + '\n');
console.log('wrote cal_maps.txt');
