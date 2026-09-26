// Full dataset report.
import fs from 'fs';
import pg from 'pg';
const url = fs.readFileSync('.env.local', 'utf8').match(/DATABASE_URL="?([^"\n\r]+)/)[1].trim();
const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await c.connect();
const q = await c.query(`select q.paper_id, q.section, q.correct_option, q.has_images, q.stem, q.options,
  q.solution_text, p.paper_name_canonical, p.paper_name_original, p.year, p.tier, p.published
  from questions q left join papers p on p.paper_id=q.paper_id`);
await c.end();
const arr = (x) => (Array.isArray(x) ? x : x && Array.isArray(x.blocks) ? x.blocks : []);
const isImg = (r) => { const sb = arr(r.stem); const ok = (r.options || []).map((o) => arr(o.blocks).map((b) => b.kind).join('')).join(','); return sb.some((b) => b.kind === 'image') || ok.includes('image') || r.has_images; };
const isTbl = (r) => arr(r.stem).some((b) => b.kind === 'table');
const yr = (p) => p.includes('-2022-') ? '2022' : p.includes('-2023-') ? '2023' : p.includes('-2024-') ? '2024' : 'other';

const sec = {}, papers = {};
let total = 0, answered = 0, withSol = 0, img = 0, tbl = 0;
for (const r of q.rows) {
  total++;
  if (r.correct_option) answered++;
  const hasSol = r.solution_text && r.solution_text.trim().length > 3;
  if (hasSol) withSol++;
  const I = isImg(r), T = isTbl(r);
  if (I) img++; else if (T) tbl++;
  const s = r.section || 'unknown';
  (sec[s] ??= { n: 0, ans: 0, sol: 0 }); sec[s].n++; if (r.correct_option) sec[s].ans++; if (hasSol) sec[s].sol++;
  const P = (papers[r.paper_id] ??= { name: r.paper_name_canonical || r.paper_name_original || r.paper_id, year: yr(r.paper_id), tier: r.tier, pub: r.published, n: 0, ans: 0, img: 0, tbl: 0, sol: 0 });
  P.n++; if (r.correct_option) P.ans++; if (I) P.img++; else if (T) P.tbl++; if (hasSol) P.sol++;
}
console.log('=== TOTALS ===');
console.log('questions:', total, '| papers:', Object.keys(papers).length);
console.log('answered (has key):', answered, '(' + (100 * answered / total).toFixed(1) + '%) | missing key:', total - answered);
console.log('with explanation:', withSol, '(' + (100 * withSol / total).toFixed(1) + '%) | NEED explanation:', total - withSol);
console.log('image questions:', img, '| table questions:', tbl, '| text-only:', total - img - tbl);
console.log('\n=== BY SECTION / TOPIC ===');
for (const [s, v] of Object.entries(sec).sort((a, b) => b[1].n - a[1].n))
  console.log(s.padEnd(24), 'Q', String(v.n).padStart(4), '| answered', String(v.ans).padStart(4), '| w/expln', String(v.sol).padStart(4));
console.log('\n=== BY PAPER ===');
const rows = Object.entries(papers).sort((a, b) => a[1].name.localeCompare(b[1].name));
for (const [pid, v] of rows)
  console.log((v.year) + ' | ' + v.name.padEnd(48).slice(0, 48) + ' | Q ' + String(v.n).padStart(3) + ' | ans ' + String(v.ans).padStart(3) + ' | img ' + String(v.img).padStart(2) + ' | tbl ' + String(v.tbl).padStart(2) + ' | expln ' + String(v.sol).padStart(3) + (v.pub === false ? ' | UNPUBLISHED' : ''));
