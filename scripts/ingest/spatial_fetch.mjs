// Build a manifest + image cache of GENUINE SPATIAL reasoning figures (excludes graphs/geometry/tables/science).
// Usage: node scripts/ingest/spatial_fetch.mjs <outDir>
import fs from 'fs';
import path from 'path';
import pg from 'pg';
const outDir = process.argv[2];
const imgDir = path.join(outDir, 'imgcache');
fs.mkdirSync(imgDir, { recursive: true });
const url = fs.readFileSync('.env.local', 'utf8').match(/DATABASE_URL="?([^"\n\r]+)/)[1].trim();
const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await c.connect();

function spatialType(t) {
  const s = (t || '').toLowerCase();
  if (/water\s*image/.test(s)) return 'Water image';
  if (/mirror/.test(s)) return 'Mirror image';
  if (/paper.*(fold|cut)|folded|punch/.test(s)) return 'Paper folding/cutting';
  if (/embedded|hidden figure|which the given figure is|part of the given figure/.test(s)) return 'Embedded figure';
  if (/how many (triangles|squares|rectangles|circles|semicircles|lines)|number of (triangles|circles|rectangles|squares|semicircles|lines)|count the number|different shapes/.test(s)) return 'Counting figures';
  if (/dice|cube/.test(s)) return 'Dice/cube';
  if (/venn|वेन आरेख|syllogism|represents the relation/.test(s)) return 'Venn diagram';
  if (/rotat/.test(s)) return 'Rotation';
  if (/complete the (series|pattern)|replace the question mark|figure series|missing.*figure|logically complete|come (next|in place)|comes next|next in the|related to the (first|second|third) figure|analog/.test(s)) return 'Figure series / analogy';
  // exclusions
  if (/pie[- ]?chart|bar[- ]?graph|bar chart|\bgraph\b|\bchart\b|\btable\b|find x|x ?\+ ?y|∠|angle|mitochond|illustration shows|researchers observed/.test(s)) return null;
  if (s.trim() === '') return 'Figure (no text — image is the question)';
  return 'Other reasoning figure';
}

const rows = (await c.query(`
  select q.id, q.paper_id, q.question_number qn, q.section, q.correct_option, coalesce(q.stem_text,'') stem_text, q.stem, q.options,
    p.paper_name_canonical, p.paper_name_original, p.year, p.paper_date, p.shift
  from questions q join papers p on p.paper_id=q.paper_id
  where q.has_images=true
  order by p.year, p.paper_date nulls last, q.paper_id, q.question_number`)).rows;
const assetsByQ = {};
for (const a of (await c.query('select question_id, role, option_key, public_url, ext from question_assets')).rows) (assetsByQ[a.question_id] ||= []).push(a);
await c.end();

const urlToFile = new Map();
const reg = (u) => { if (!u) return null; const f = u.split('/').pop(); urlToFile.set(u, f); return f; };
const manifest = [];
for (const r of rows) {
  const ty = spatialType(r.stem_text);
  if (!ty) continue; // excluded (graph/geometry/table/science)
  const assets = assetsByQ[r.id] || [];
  // skip if the (only) figure is already an SVG recreation of a chart — but spatial ones are raster; keep all
  const stem = assets.filter((a) => a.role === 'stem').map((a) => ({ file: reg(a.public_url), ext: a.ext }));
  const optA = Object.fromEntries(assets.filter((a) => a.role === 'option').map((a) => [a.option_key, a]));
  const options = (r.options || []).map((o) => { const oa = optA[o.key]; return { key: o.key, isImage: !!(o.isImage || oa), text: o.text || '', file: oa ? reg(oa.public_url) : null, ext: oa ? oa.ext : null }; });
  manifest.push({ paper_id: r.paper_id, paper_name: r.paper_name_canonical || r.paper_name_original || r.paper_id, year: r.year, paper_date: r.paper_date, shift: r.shift, qn: r.qn, section: r.section, correct_option: r.correct_option, stem_text: r.stem_text, type: ty, stem_images: stem, options });
}
// download
const tasks = [...urlToFile.entries()]; let done = 0, failed = [];
async function fetchOne([u, f], attempt = 1) { const dest = path.join(imgDir, f); if (fs.existsSync(dest) && fs.statSync(dest).size > 0) { done++; return; }
  try { const res = await fetch(u); if (!res.ok) throw new Error('HTTP ' + res.status); fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer())); done++; }
  catch (e) { if (attempt < 4) { await new Promise((r) => setTimeout(r, 400 * attempt)); return fetchOne([u, f], attempt + 1); } failed.push(f); } }
for (let i = 0; i < tasks.length; i += 12) { await Promise.all(tasks.slice(i, i + 12).map((t) => fetchOne(t))); process.stdout.write(`\r${done}/${tasks.length}`); }
fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 1));
const byType = {}; manifest.forEach((m) => byType[m.type] = (byType[m.type] || 0) + 1);
console.log('\nspatial questions:', manifest.length, '| images:', urlToFile.size, '| failed:', failed.length);
console.log('by type:', JSON.stringify(byType, null, 1));
