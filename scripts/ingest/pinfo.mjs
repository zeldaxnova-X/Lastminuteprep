// Dump a paper's image/table/corrupt question list + write a qs.json mapping.
// Usage: node scripts/ingest/pinfo.mjs <paper_id> <out_json_path>
import fs from 'fs';
import pg from 'pg';
const url = fs.readFileSync('.env.local', 'utf8').match(/DATABASE_URL="?([^"\n\r]+)/)[1].trim();
const paper = process.argv[2];
const out = process.argv[3];
const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await c.connect();
const q = await c.query(
  'select question_number qn, external_id, section, correct_option, stem, options, has_images, stem_text from questions where paper_id=$1 order by question_number',
  [paper]
);
await c.end();
const arr = (x) => (Array.isArray(x) ? x : x && Array.isArray(x.blocks) ? x.blocks : []);
if (out) fs.writeFileSync(out, JSON.stringify(q.rows.map((r) => ({ qn: r.qn, external_id: r.external_id, section: r.section, ans: r.correct_option }))));
const img = [], tbl = [], corrupt = [];
for (const r of q.rows) {
  const sb = arr(r.stem);
  const ok = (r.options || []).map((o) => arr(o.blocks).map((b) => b.kind).join('')).join(',');
  const hasImg = sb.some((b) => b.kind === 'image') || ok.includes('image') || r.has_images;
  const hasTbl = sb.some((b) => b.kind === 'table');
  const txt = (r.stem_text || '') + JSON.stringify(r.options || '');
  if (/[ऀ-ॿ]/.test(txt)) corrupt.push(r.qn);
  else if (hasImg) img.push(r.qn);
  else if (hasTbl) tbl.push(r.qn);
}
console.log('IMAGE:', img.join(','));
console.log('TABLE:', tbl.join(','));
console.log('CORRUPT:', corrupt.join(','));
