// Update DB + storage with the manually-enhanced HD images from manualretrieval.docx.
// Resolves each target asset by ROLE (stem/option) from the DB (handles _fig/_stem naming),
// re-uploads HD bytes, refreshes question_assets sha256/byte_length, and for svg->png stems
// also flips ext/storage_path/public_url and rewrites the stem jsonb image URL.
// Usage: node scripts/ingest/manual_update.mjs <unzippedDocxDir> <mapping.json> [--apply]
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import pg from 'pg';
import sharp from 'sharp';

const dir = process.argv[2];
const mapping = JSON.parse(fs.readFileSync(process.argv[3], 'utf8')).map;
const APPLY = process.argv.includes('--apply');
const env = fs.readFileSync('.env.local', 'utf8');
const DBURL = env.match(/DATABASE_URL="?([^"\n\r]+)/)[1].trim();
const SURL = env.match(/NEXT_PUBLIC_SUPABASE_URL="?([^"\n\r]+)/)[1].trim();
const SKEY = env.match(/SUPABASE_SERVICE_ROLE_KEY="?([^"\n\r]+)/)[1].trim();
const c = new pg.Client({ connectionString: DBURL, ssl: { rejectUnauthorized: false } });
await c.connect();

const byQ = {};
for (const m of mapping) (byQ[m.paper_id + '||' + m.qn] ||= []).push(m);

const plan = { replace: [], svg2png: [], skip: [] };

for (const [k, entries] of Object.entries(byQ)) {
  const [paper_id, qn] = k.split('||');
  const qr = await c.query('select id, stem, options from questions where paper_id=$1 and question_number=$2', [paper_id, Number(qn)]);
  if (!qr.rows.length) { entries.forEach((e) => plan.skip.push({ ...e, why: 'no question row' })); continue; }
  const q = qr.rows[0];
  const assets = (await c.query('select id, asset_key, role, option_key, ext, storage_path, public_url from question_assets where question_id=$1', [q.id])).rows;
  for (const e of entries) {
    const asset = e.role === 'stem'
      ? assets.find((a) => a.role === 'stem')
      : assets.find((a) => a.role === 'option' && a.option_key === e.optKey);
    if (!asset) { plan.skip.push({ ...e, why: 'no matching DB asset (question likely text / not image)' }); continue; }
    const rec = { qid: q.id, e, asset };
    if (asset.ext === 'svg') plan.svg2png.push(rec); else plan.replace.push(rec);
  }
}

async function readMedia(m) {
  const p = path.join(dir, 'word', m.replace(/^media\//, 'media/'));
  const buf = fs.readFileSync(p);
  const meta = await sharp(buf).metadata();
  return { buf, meta };
}
async function upload(storagePath, buf) {
  const res = await fetch(`${SURL}/storage/v1/object/question-assets/${storagePath}`, {
    method: 'POST', headers: { apikey: SKEY, Authorization: 'Bearer ' + SKEY, 'Content-Type': 'image/png', 'x-upsert': 'true' }, body: buf,
  });
  if (!res.ok) throw new Error('upload ' + res.status + ' ' + (await res.text()).slice(0, 120));
}

console.log(`PLAN  replace(png):${plan.replace.length}  svg->png:${plan.svg2png.length}  skip:${plan.skip.length}   [${APPLY ? 'APPLY' : 'DRY-RUN'}]`);
if (plan.skip.length) { console.log('\nSKIPPED (need your decision):'); for (const s of plan.skip) console.log('  -', s.paper_id, 'Q' + s.qn, s.role + (s.optKey || ''), '::', s.why); }

let done = 0, failed = [];
async function doReplace(rec, svg) {
  const { buf, meta } = await readMedia(rec.e.media);
  const sha = crypto.createHash('sha256').update(buf).digest('hex');
  const oldPath = rec.asset.storage_path;
  const newPath = svg ? oldPath.replace(/\.svg$/, '.png') : oldPath;
  const newUrl = svg ? rec.asset.public_url.replace(/\.svg$/, '.png') : rec.asset.public_url;
  if (!APPLY) { console.log(`  would ${svg ? 'SVG→PNG' : 'replace'} ${rec.asset.asset_key} (${meta.width}x${meta.height}, ${(buf.length/1024).toFixed(0)}KB) -> ${newPath}`); return; }
  await upload(newPath, buf);
  await c.query('update question_assets set sha256=$1, byte_length=$2, ext=$3, storage_path=$4, public_url=$5 where id=$6',
    [sha, buf.length, 'png', newPath, newUrl, rec.asset.id]);
  if (svg) {
    // rewrite the stem/option jsonb image URL from .svg to .png
    const col = rec.e.role === 'stem' ? 'stem' : 'options';
    const cur = (await c.query(`select ${col} v from questions where id=$1`, [rec.qid])).rows[0].v;
    const fix = (blocks) => (blocks || []).map((b) => b && b.kind === 'image' && typeof b.url === 'string' ? { ...b, url: b.url.replace(/\.svg$/, '.png') } : b);
    let next;
    if (col === 'stem') next = fix(cur);
    else next = (cur || []).map((o) => o.key === rec.e.optKey ? { ...o, blocks: fix(o.blocks) } : o);
    await c.query(`update questions set ${col}=$1::jsonb, updated_at=now() where id=$2`, [JSON.stringify(next), rec.qid]);
  } else {
    await c.query('update questions set updated_at=now() where id=$1', [rec.qid]);
  }
  done++;
}

for (const rec of plan.replace) { try { await doReplace(rec, false); } catch (e) { failed.push([rec.asset.asset_key, e.message]); } }
for (const rec of plan.svg2png) { try { await doReplace(rec, true); } catch (e) { failed.push([rec.asset.asset_key, e.message]); } }

await c.end();
if (APPLY) console.log(`\nAPPLIED ${done} updates.` + (failed.length ? ` FAILED ${failed.length}: ` + JSON.stringify(failed.slice(0, 5)) : ''));
else console.log('\nDry-run complete. Re-run with --apply to execute.');
