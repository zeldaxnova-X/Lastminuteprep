// Flag near-empty / sliver / corner-fragment crops from ink.json, and montage them to verify.
// Usage: node scripts/ingest/imgcropflag.mjs <workDir>
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const workDir = process.argv[2];
const imgDir = path.join(workDir, 'imgcache');
const rows = JSON.parse(fs.readFileSync(path.join(workDir, 'ink.json'), 'utf8')).filter((r) => !r.svg && !r.error);

function reason(r) {
  if (r.inkFrac < 0.008) return 'near-empty';
  if ((r.aspect >= 3.5 || r.aspect <= 0.29) && r.inkFrac < 0.025) return 'sliver crop';
  if (r.bboxFrac < 0.2 && r.inkFrac < 0.04) return 'corner fragment';
  return null;
}
const flagged = rows.map((r) => ({ ...r, reason: reason(r) })).filter((r) => r.reason);
flagged.sort((a, b) => a.paper_id.localeCompare(b.paper_id) || a.qn - b.qn || String(a.optKey).localeCompare(String(b.optKey)));
fs.writeFileSync(path.join(workDir, 'crop_flags.json'), JSON.stringify(flagged, null, 1));
console.log('crop-flagged:', flagged.length);
const byReason = {}; flagged.forEach((r) => byReason[r.reason] = (byReason[r.reason] || 0) + 1);
console.log('by reason:', JSON.stringify(byReason));
const byPaper = {}; flagged.forEach((r) => byPaper[r.paper] = (byPaper[r.paper] || 0) + 1);
console.log('by paper:', JSON.stringify(byPaper, null, 1));

// montage to verify
const CELL = 230, COLS = 7, PAD = 5, LBL = 14;
const rowsN = Math.ceil(flagged.length / COLS);
const W = COLS * (CELL + PAD) + PAD, H = rowsN * (CELL + LBL + PAD) + PAD;
const comp = [];
for (let i = 0; i < flagged.length; i++) {
  const r = flagged[i];
  const cx = PAD + (i % COLS) * (CELL + PAD), cy = PAD + Math.floor(i / COLS) * (CELL + LBL + PAD);
  try {
    const t = await sharp(path.join(imgDir, r.file)).flatten({ background: '#fff' }).resize(CELL, CELL, { fit: 'contain', background: '#fff' }).png().toBuffer();
    comp.push({ input: t, left: cx, top: cy + LBL });
  } catch {}
  const svg = Buffer.from(`<svg width="${CELL}" height="${LBL}"><rect width="100%" height="100%" fill="#7a1f1f"/><text x="3" y="11" font-family="Arial" font-size="10" fill="#fff">${i} Q${r.qn}${r.optKey||'F'} ${r.reason}</text></svg>`);
  comp.push({ input: svg, left: cx, top: cy });
}
await sharp({ create: { width: W, height: H, channels: 3, background: '#ccc' } }).composite(comp).png().toFile(path.join(workDir, 'verify_crops.png'));
console.log('wrote verify_crops.png');
