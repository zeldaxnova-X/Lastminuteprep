// Fetch every image-question's assets + metadata, download all images locally,
// and write a manifest.json for the docx builder.
// Usage: node scripts/ingest/imgdocx_fetch.mjs <outDir>
import fs from 'fs';
import path from 'path';
import pg from 'pg';

const outDir = process.argv[2];
const imgDir = path.join(outDir, 'imgcache');
fs.mkdirSync(imgDir, { recursive: true });

const url = fs.readFileSync('.env.local', 'utf8').match(/DATABASE_URL="?([^"\n\r]+)/)[1].trim();
const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await c.connect();

// Papers ordered chronologically; join to get proper names.
const rows = (await c.query(`
  select q.id, q.paper_id, q.question_number qn, q.section, q.correct_option, q.stem_text, q.stem, q.options,
         p.paper_name_canonical, p.paper_name_original, p.year, p.paper_date, p.shift
  from questions q
  join papers p on p.paper_id = q.paper_id
  where q.has_images = true
  order by p.year, p.paper_date nulls last, q.paper_id, q.question_number
`)).rows;

const assetsByQ = {};
for (const a of (await c.query('select question_id, role, option_key, public_url, ext from question_assets')).rows) {
  (assetsByQ[a.question_id] ||= []).push(a);
}
await c.end();

console.log('image questions:', rows.length);

// Collect unique download tasks
const urlToFile = new Map();
const fileName = (u) => u.split('/').pop();
function register(u) {
  if (!u) return null;
  const f = fileName(u);
  if (!urlToFile.has(u)) urlToFile.set(u, f);
  return f;
}

const manifest = [];
for (const r of rows) {
  const assets = assetsByQ[r.id] || [];
  const stem = assets.filter((a) => a.role === 'stem').map((a) => ({ file: register(a.public_url), ext: a.ext }));
  const optAssets = Object.fromEntries(assets.filter((a) => a.role === 'option').map((a) => [a.option_key, a]));
  const opts = (r.options || []).map((o) => {
    const oa = optAssets[o.key];
    return {
      key: o.key,
      isImage: !!(o.isImage || oa),
      text: o.text || '',
      file: oa ? register(oa.public_url) : null,
      ext: oa ? oa.ext : null,
    };
  });
  manifest.push({
    paper_id: r.paper_id,
    paper_name: r.paper_name_canonical || r.paper_name_original || r.paper_id,
    year: r.year,
    paper_date: r.paper_date,
    shift: r.shift,
    qn: r.qn,
    section: r.section,
    correct_option: r.correct_option,
    stem_text: r.stem_text || '',
    stem_images: stem,
    options: opts,
  });
}

// Download all unique images with limited concurrency + retry.
const tasks = [...urlToFile.entries()];
let done = 0, failed = [];
async function fetchOne([u, f], attempt = 1) {
  const dest = path.join(imgDir, f);
  if (fs.existsSync(dest) && fs.statSync(dest).size > 0) { done++; return; }
  try {
    const res = await fetch(u);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(dest, buf);
    done++;
  } catch (e) {
    if (attempt < 4) { await new Promise((r) => setTimeout(r, 500 * attempt)); return fetchOne([u, f], attempt + 1); }
    failed.push(f);
  }
}
const CONC = 12;
for (let i = 0; i < tasks.length; i += CONC) {
  await Promise.all(tasks.slice(i, i + CONC).map((t) => fetchOne(t)));
  process.stdout.write(`\rdownloaded ${done}/${tasks.length}`);
}
console.log('\ndownload complete. failed:', failed.length);
if (failed.length) fs.writeFileSync(path.join(outDir, 'failed.json'), JSON.stringify(failed, null, 2));

fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log('manifest written:', manifest.length, 'questions;', urlToFile.size, 'unique images');
