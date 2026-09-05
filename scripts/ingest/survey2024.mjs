// Survey image/table/corrupt question counts across all 2024 papers.
import fs from 'fs';
import pg from 'pg';
const url = fs.readFileSync('.env.local', 'utf8').match(/DATABASE_URL="?([^"\n\r]+)/)[1].trim();
const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await c.connect();
const q = await c.query(
  `select paper_id, question_number qn, stem, options, has_images, stem_text
   from questions where paper_id like 'ssc-cgl-tier-1-2024-%' order by paper_id, question_number`
);
await c.end();
const arr = (x) => (Array.isArray(x) ? x : x && Array.isArray(x.blocks) ? x.blocks : []);
const byPaper = {};
for (const r of q.rows) {
  (byPaper[r.paper_id] ??= { img: [], tbl: [], corrupt: [], total: 0 });
  const p = byPaper[r.paper_id];
  p.total++;
  const sb = arr(r.stem);
  const ok = (r.options || []).map((o) => arr(o.blocks).map((b) => b.kind).join('')).join(',');
  const hasImg = sb.some((b) => b.kind === 'image') || ok.includes('image') || r.has_images;
  const hasTbl = sb.some((b) => b.kind === 'table');
  const txt = (r.stem_text || '') + JSON.stringify(r.options || '');
  if (/[ऀ-ॿ]/.test(txt)) p.corrupt.push(r.qn);
  else if (hasImg) p.img.push(r.qn);
  else if (hasTbl) p.tbl.push(r.qn);
}
let ti = 0, tt = 0, tc = 0;
for (const [pid, p] of Object.entries(byPaper)) {
  ti += p.img.length; tt += p.tbl.length; tc += p.corrupt.length;
  console.log(pid.replace('ssc-cgl-tier-1-2024-2024-', ''),
    '| img', p.img.length, '[' + p.img.join(',') + ']',
    '| tbl', p.tbl.length, '| corrupt', p.corrupt.length);
}
console.log('\nTOTALS: papers', Object.keys(byPaper).length, '| image-Q', ti, '| table-Q', tt, '| corrupt-Q', tc);
