// Apply bigdatarefresh.docx recreated images to DB + storage.
// - PNG sources uploaded from word/media; EMF sources uploaded from the pre-converted PNGs (converted/).
// - Resolves target asset by role (stem) / role+option_key (option); orphans (no DB asset) are skipped.
// - png target: replace bytes, refresh sha256/byte_length.
// - svg target: flip ext/storage_path/public_url to .png, upload png, rewrite (or inject) the jsonb image block.
// Backs up every affected question + question_asset row before applying.
// Usage: node scripts/ingest/bigrefresh_apply.mjs <unzippedDir> <mapping.json> <backup.json> [--apply]
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import pg from 'pg';
import sharp from 'sharp';

const dir = process.argv[2];
const mapping = JSON.parse(fs.readFileSync(process.argv[3], 'utf8')).map;
const backupPath = process.argv[4];
const APPLY = process.argv.includes('--apply');
const env = fs.readFileSync('.env.local', 'utf8');
const DBURL = env.match(/DATABASE_URL="?([^"\n\r]+)/)[1].trim();
const SURL = env.match(/NEXT_PUBLIC_SUPABASE_URL="?([^"\n\r]+)/)[1].trim();
const SKEY = env.match(/SUPABASE_SERVICE_ROLE_KEY="?([^"\n\r]+)/)[1].trim();
const convDir = path.join(dir, 'converted');
const c = new pg.Client({ connectionString: DBURL, ssl: { rejectUnauthorized: false } });
await c.connect();

const byQ = {};
for (const m of mapping) (byQ[m.paper_id + '||' + m.qn] ||= []).push(m);

const plan = { replace: [], svg2png: [], skip: [] };
const backup = { questions: {}, assets: {} };

for (const [k, entries] of Object.entries(byQ)) {
  const [paper_id, qn] = k.split('||');
  const qr = await c.query('select id, has_images, stem, options from questions where paper_id=$1 and question_number=$2', [paper_id, Number(qn)]);
  if (!qr.rows.length) { entries.forEach((e) => plan.skip.push({ ...e, why: 'no question row' })); continue; }
  const q = qr.rows[0];
  const assets = (await c.query('select id, asset_key, role, option_key, ext, storage_path, public_url from question_assets where question_id=$1', [q.id])).rows;
  const stemAssets = assets.filter((a) => a.role === 'stem');
  for (const e of entries) {
    const asset = e.role === 'stem'
      ? (stemAssets.length === 1 ? stemAssets[0] : (stemAssets.find((a) => /_fig$/.test(a.asset_key)) || stemAssets[0]))
      : assets.find((a) => a.role === 'option' && a.option_key === e.optKey);
    if (!asset) { plan.skip.push({ ...e, why: 'no matching DB asset (question likely text-stem / image missing in doc)' }); continue; }
    backup.questions[q.id] ||= { id: q.id, paper_id, question_number: Number(qn), has_images: q.has_images, stem: q.stem, options: q.options };
    backup.assets[asset.id] ||= { ...asset };
    const rec = { qid: q.id, e, asset };
    if (asset.ext === 'svg') plan.svg2png.push(rec); else plan.replace.push(rec);
  }
}

function srcPath(media) {
  if (/\.emf$/i.test(media)) return path.join(convDir, media.replace(/\.emf$/i, '.png'));
  return path.join(dir, 'word', 'media', media);
}
async function readBytes(media) {
  const p = srcPath(media);
  const buf = fs.readFileSync(p);
  let meta = {}; try { meta = await sharp(buf).metadata(); } catch {}
  return { buf, meta };
}
async function upload(storagePath, buf) {
  const res = await fetch(`${SURL}/storage/v1/object/question-assets/${storagePath}`, {
    method: 'POST', headers: { apikey: SKEY, Authorization: 'Bearer ' + SKEY, 'Content-Type': 'image/png', 'x-upsert': 'true' }, body: buf,
  });
  if (!res.ok) throw new Error('upload ' + res.status + ' ' + (await res.text()).slice(0, 160));
}

console.log(`PLAN  replace(png):${plan.replace.length}  svg->png:${plan.svg2png.length}  skip:${plan.skip.length}   [${APPLY ? 'APPLY' : 'DRY-RUN'}]`);
if (plan.skip.length) { console.log('SKIPPED:'); for (const s of plan.skip) console.log('  -', s.paper_id, 'Q' + s.qn, s.role + (s.optKey || ''), '::', s.why, '(' + s.media + ')'); }

// write backup before any mutation
fs.writeFileSync(backupPath, JSON.stringify({ questions: Object.values(backup.questions), assets: Object.values(backup.assets) }, null, 1));
console.log('backup written:', backupPath, '| questions:', Object.keys(backup.questions).length, '| assets:', Object.keys(backup.assets).length);

let done = 0; const failed = [];
async function doOne(rec, svg) {
  const { buf, meta } = await readBytes(rec.e.media);
  const sha = crypto.createHash('sha256').update(buf).digest('hex');
  const oldPath = rec.asset.storage_path;
  const newPath = svg ? oldPath.replace(/\.svg$/, '.png') : oldPath;
  const newUrl = svg ? rec.asset.public_url.replace(/\.svg$/, '.png') : rec.asset.public_url;
  if (!APPLY) { console.log(`  would ${svg ? 'SVG→PNG' : 'replace'} ${rec.asset.asset_key} (${meta.width || '?'}x${meta.height || '?'}, ${(buf.length / 1024).toFixed(0)}KB, src ${rec.e.media}) -> ${newPath}`); return; }
  await upload(newPath, buf);
  await c.query('update question_assets set sha256=$1, byte_length=$2, ext=$3, storage_path=$4, public_url=$5 where id=$6',
    [sha, buf.length, 'png', newPath, newUrl, rec.asset.id]);
  if (svg) {
    const col = rec.e.role === 'stem' ? 'stem' : 'options';
    const cur = (await c.query(`select ${col} v from questions where id=$1`, [rec.qid])).rows[0].v;
    const fixBlocks = (blocks) => {
      const arr = (blocks || []).map((b) => b && b.kind === 'image' && typeof b.url === 'string' ? { ...b, url: b.url.replace(/\.svg$/, '.png') } : b);
      if (!arr.some((b) => b && b.kind === 'image')) arr.push({ url: newUrl, kind: 'image', assetId: rec.asset.asset_key }); // inject if none existed
      return arr;
    };
    let next;
    if (col === 'stem') next = fixBlocks(cur);
    else next = (cur || []).map((o) => o.key === rec.e.optKey ? { ...o, blocks: fixBlocks(o.blocks) } : o);
    await c.query(`update questions set ${col}=$1::jsonb, has_images=true, updated_at=now() where id=$2`, [JSON.stringify(next), rec.qid]);
  } else {
    await c.query('update questions set updated_at=now() where id=$1', [rec.qid]);
  }
  done++;
}

for (const rec of plan.replace) { try { await doOne(rec, false); } catch (e) { failed.push([rec.asset.asset_key, e.message]); } }
for (const rec of plan.svg2png) { try { await doOne(rec, true); } catch (e) { failed.push([rec.asset.asset_key, e.message]); } }

await c.end();
if (APPLY) console.log(`\nAPPLIED ${done} updates.` + (failed.length ? ` FAILED ${failed.length}: ` + JSON.stringify(failed.slice(0, 8)) : ' No failures.'));
else console.log('\nDry-run complete. Re-run with --apply to execute.');
