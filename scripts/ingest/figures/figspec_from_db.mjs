// Auto-generate a fig-extraction spec from the CURRENT DB state, for re-rendering
// figures without touching stem/options/keys. Emits {qn:{opts:"img"|"text"}} for
// every question whose stem carries a PNG image (skips SVG recreations, which are
// already clean vector). opts:"img" when the 4 options are images too.
// Usage: node figspec_from_db.mjs <paper_id> <out_fig.json>
import fs from 'fs';
import pg from 'pg';
const url = fs.readFileSync('.env.local', 'utf8').match(/DATABASE_URL="?([^"\n\r]+)/)[1].trim();
const paper = process.argv[2], out = process.argv[3];
const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await c.connect();
const q = await c.query('select question_number qn, stem, options from questions where paper_id=$1 order by question_number', [paper]);
await c.end();
const arr = (x) => (Array.isArray(x) ? x : x && Array.isArray(x.blocks) ? x.blocks : []);
const spec = {}; const skipSvg = [];
for (const r of q.rows) {
  const sb = arr(r.stem);
  const stemImg = sb.find((b) => b.kind === 'image');
  if (!stemImg) continue;                       // only re-render questions with a stem figure
  const ext = (stemImg.url || '').split('.').pop().toLowerCase();
  if (ext === 'svg') { skipSvg.push(r.qn); continue; } // recreated SVG: already clean, leave it
  const optsImg = (r.options || []).every((o) => arr(o.blocks).some((b) => b.kind === 'image'));
  spec[r.qn] = { opts: optsImg ? 'img' : 'text' };
}
fs.writeFileSync(out, JSON.stringify(spec, null, 2));
console.log('fig questions:', Object.keys(spec).join(','), '| skipped SVG:', skipSvg.join(',') || 'none');
