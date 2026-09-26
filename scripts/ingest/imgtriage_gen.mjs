// Generate labeled triage montages of ALL image assets (ordered), for visual defect review.
// Usage: node scripts/ingest/imgtriage_gen.mjs <workDir>
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const workDir = process.argv[2];
const imgDir = path.join(workDir, 'imgcache');
const manifest = JSON.parse(fs.readFileSync(path.join(workDir, 'manifest.json'), 'utf8'));
const outDir = path.join(workDir, 'triage');
fs.mkdirSync(outDir, { recursive: true });

// Ordered list of every image with context, in manifest order.
const items = [];
for (const q of manifest) {
  for (const s of q.stem_images) items.push({ file: s.file, paper_id: q.paper_id, paper: q.paper_name, qn: q.qn, role: 'fig', optKey: null });
  for (const o of q.options) if (o.isImage && o.file) items.push({ file: o.file, paper_id: q.paper_id, paper: q.paper_name, qn: q.qn, role: 'opt', optKey: o.key });
}

const CELL = 210, COLS = 7, ROWS = 7, PER = COLS * ROWS, PAD = 5, LBL = 15;
const pages = Math.ceil(items.length / PER);
const mapLines = [];

for (let pg = 0; pg < pages; pg++) {
  const slice = items.slice(pg * PER, pg * PER + PER);
  const W = COLS * (CELL + PAD) + PAD;
  const H = Math.ceil(slice.length / COLS) * (CELL + LBL + PAD) + PAD;
  const comp = [];
  for (let i = 0; i < slice.length; i++) {
    const it = slice[i];
    const gi = pg * PER + i;
    const cx = PAD + (i % COLS) * (CELL + PAD);
    const cy = PAD + Math.floor(i / COLS) * (CELL + LBL + PAD);
    try {
      const thumb = await sharp(path.join(imgDir, it.file))
        .flatten({ background: '#ffffff' })
        .resize(CELL, CELL, { fit: 'contain', background: '#ffffff' })
        .png().toBuffer();
      comp.push({ input: thumb, left: cx, top: cy + LBL });
    } catch { /* skip */ }
    const svg = Buffer.from(`<svg width="${CELL}" height="${LBL}"><rect width="100%" height="100%" fill="#1F3A5F"/><text x="3" y="11" font-family="Arial" font-size="10" fill="#fff">${gi}  Q${it.qn}${it.role==='opt'?' '+it.optKey:'F'}</text></svg>`);
    comp.push({ input: svg, left: cx, top: cy });
    mapLines.push(`${gi}\t${it.file}\t${it.paper}\tQ${it.qn}\t${it.role}${it.optKey||''}`);
  }
  const name = `triage_${String(pg).padStart(2, '0')}.png`;
  await sharp({ create: { width: W, height: H, channels: 3, background: '#cccccc' } })
    .composite(comp).png().toFile(path.join(outDir, name));
  process.stdout.write(`\rpage ${pg + 1}/${pages}`);
}
fs.writeFileSync(path.join(workDir, 'triage_map.tsv'), mapLines.join('\n'));
console.log('\nwrote', pages, 'triage pages +', items.length, 'map rows');
