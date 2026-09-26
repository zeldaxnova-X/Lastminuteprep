// Generate chart SVGs from chartspec (+ Q59 pie+table, + Q68 geometry) and replace the
// raster stem asset with the SVG in storage + DB. Usage: node ... <workDir> [--apply]
import fs from 'fs';
import crypto from 'crypto';
import pg from 'pg';
import { pieSVG, barSVG } from './chartgen.mjs';

const WORK = process.argv[2];
const APPLY = process.argv.includes('--apply');
const spec = JSON.parse(fs.readFileSync(WORK + '/chartspec.json', 'utf8'));
const targets = JSON.parse(fs.readFileSync(WORK + '/targets.json', 'utf8'));
const env = fs.readFileSync('.env.local', 'utf8');
const DBURL = env.match(/DATABASE_URL="?([^"\n\r]+)/)[1].trim();
const SURL = env.match(/NEXT_PUBLIC_SUPABASE_URL="?([^"\n\r]+)/)[1].trim();
const SKEY = env.match(/SUPABASE_SERVICE_ROLE_KEY="?([^"\n\r]+)/)[1].trim();
const suffix = (pid) => pid.slice(-18);
const tByKey = {}; for (const t of targets) tByKey[suffix(t.paper_id) + '|' + t.qn] = t;

// build SVGs
const built = {};
for (const [k, e] of Object.entries(spec)) {
  built[k] = e.type === 'pie'
    ? pieSVG({ title: e.title, mode: e.mode, slices: e.slices.map(([label, value]) => ({ label, value })) })
    : barSVG({ title: e.title, ylabel: e.ylabel, categories: e.categories, series: e.series.map(([name, values]) => ({ name, values })) });
}
// Q59: pie (production) — table added to stem separately
const Q59 = '2024-09-12-shift-3|59';
built[Q59] = pieSVG({ title: 'Distribution of employees', mode: 'percent', slices: [['Production', 30], ['HR', 8], ['IT', 15], ['Accounts', 25], ['Marketing', 22]].map(([label, value]) => ({ label, value })) });
const Q59_TABLE = [['Department', 'Male : Female'], ['HR', '3 : 5'], ['IT', '2 : 3'], ['Accounts', '3 : 7'], ['Marketing', '7 : 4'], ['Production', '5 : 3']];
// Q68: geometry angle figure
const Q68 = '2022-12-01-shift-3|68';
built[Q68] = geomQ68();

const c = new pg.Client({ connectionString: DBURL, ssl: { rejectUnauthorized: false } });
await c.connect();
let done = 0, miss = [];
for (const [k, svg] of Object.entries(built)) {
  const t = tByKey[k];
  if (!t) { miss.push(k + ' (no target)'); continue; }
  const q = (await c.query('select id, stem from questions where id=$1', [t.id])).rows[0];
  const asset = (await c.query("select id, asset_key, storage_path, public_url, ext from question_assets where question_id=$1 and role='stem'", [t.id])).rows[0];
  if (!asset) { miss.push(k + ' (no stem asset)'); continue; }
  const newPath = asset.storage_path.replace(/\.(png|svg)$/, '.svg');
  const newUrl = asset.public_url.replace(/\.(png|svg)$/, '.svg');
  const buf = Buffer.from(svg, 'utf8');
  if (!APPLY) { console.log(`would build ${k} -> ${newPath} (${(buf.length/1024).toFixed(1)}KB)`); continue; }
  // upload
  const res = await fetch(`${SURL}/storage/v1/object/question-assets/${newPath}`, { method: 'POST', headers: { apikey: SKEY, Authorization: 'Bearer ' + SKEY, 'Content-Type': 'image/svg+xml', 'x-upsert': 'true' }, body: buf });
  if (!res.ok) { miss.push(k + ' upload ' + res.status); continue; }
  // update asset
  await c.query('update question_assets set ext=$1, storage_path=$2, public_url=$3, sha256=$4, byte_length=$5 where id=$6',
    ['svg', newPath, newUrl, crypto.createHash('sha256').update(buf).digest('hex'), buf.length, asset.id]);
  // update stem jsonb: point image block to .svg; for Q59 append table
  let stem = (q.stem || []).map((b) => b && b.kind === 'image' && typeof b.url === 'string' ? { ...b, url: b.url.replace(/\.(png|svg)$/, '.svg') } : b);
  if (k === Q59 && !stem.some((b) => b.kind === 'table')) stem = [...stem, { kind: 'table', rows: Q59_TABLE }];
  await c.query('update questions set stem=$1::jsonb, updated_at=now() where id=$2', [JSON.stringify(stem), t.id]);
  done++;
}
await c.end();
console.log(APPLY ? `APPLIED ${done}` : 'dry-run', 'misses:', miss.length, miss.slice(0, 8));

function geomQ68() {
  // A apex; base line B-C-D extended; cevians A-C, A-D; angles x,y at A, z at B, 110 at C, 120 at D
  const B = [70, 340], C = [340, 340], D = [520, 340], E = [620, 340], A = [210, 90];
  const L = (p, q, w = 2) => `<line x1="${p[0]}" y1="${p[1]}" x2="${q[0]}" y2="${q[1]}" stroke="#1e293b" stroke-width="${w}"/>`;
  const T = (x, y, s, sz = 20, it = 1) => `<text x="${x}" y="${y}" font-family="Georgia, serif" font-size="${sz}" font-style="${it ? 'italic' : 'normal'}" fill="#0f172a">${s}</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 680 400" font-family="Georgia, serif"><rect width="680" height="400" fill="#fff"/>`
    + L(B, E, 2) + L(A, B) + L(A, C) + L(A, D)
    + T(A[0] - 8, A[1] - 12, 'A', 22, 0)
    + T(B[0] - 22, B[1] + 24, 'B', 22, 0) + T(C[0] - 6, C[1] + 26, 'C', 22, 0) + T(D[0] - 6, D[1] + 26, 'D', 22, 0)
    + T(A[0] - 26, A[1] + 46, 'x') + T(A[0] + 14, A[1] + 52, 'y') + T(B[0] + 26, B[1] - 10, 'z')
    + T(C[0] + 8, C[1] - 12, '110°', 19, 0) + T(D[0] + 8, D[1] - 12, '120°', 19, 0)
    + `</svg>`;
}
