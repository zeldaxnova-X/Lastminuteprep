// Cross-check bigrefresh mapping against DB question_assets. Resolves each image's target
// asset by (role, option_key) since a stem asset may be _fig OR _stem in the DB.
// Usage: node scripts/ingest/bigrefresh_verify.mjs <mapping.json>
import fs from 'fs';
import pg from 'pg';
const url = fs.readFileSync('.env.local', 'utf8').match(/DATABASE_URL="?([^"\n\r]+)/)[1].trim();
const { map } = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await c.connect();

const byQ = {};
for (const m of map) { const k = m.paper_id + '||' + m.qn; (byQ[k] ||= []).push(m); }

let resolved = 0;
const orphans = [], collisions = [], uncovered = [], noQuestion = [], notImage = [], extNote = [];
const resolvedList = []; // {media, mediaExt, question_id, asset_key, targetExt, storage_path, public_url, role, optKey}

for (const [k, entries] of Object.entries(byQ)) {
  const [paper_id, qn] = k.split('||');
  const qr = await c.query('select id, correct_option, options from questions where paper_id=$1 and question_number=$2', [paper_id, Number(qn)]);
  if (!qr.rows.length) { noQuestion.push(`${paper_id} Q${qn} (${entries.length} imgs)`); continue; }
  const q = qr.rows[0];
  const assets = (await c.query('select asset_key, role, option_key, ext, storage_path, public_url from question_assets where question_id=$1', [q.id])).rows;
  const stemAssets = assets.filter((a) => a.role === 'stem');
  const optAsset = {}; for (const a of assets.filter((a) => a.role === 'option')) optAsset[a.option_key] = a;
  const optIsImage = {}; for (const o of (q.options || [])) optIsImage[o.key] = !!o.isImage;
  const usedKey = {}; // asset_key -> count of images mapped to it

  for (const e of entries) {
    let a = null;
    if (e.role === 'stem') { a = stemAssets.length === 1 ? stemAssets[0] : (stemAssets.find((x) => /_fig$/.test(x.asset_key)) || stemAssets[0]); }
    else { a = optAsset[e.optKey]; if (a && optIsImage[e.optKey] === false) notImage.push(`${paper_id} Q${qn} opt${e.optKey}: DB option is TEXT (img ${e.media})`); }
    if (!a) {
      orphans.push(`${paper_id} Q${qn} ${e.role}${e.optKey ? ' ' + e.optKey : ''} img=${e.media} [DB: ${assets.map((x) => x.role + (x.option_key || '') + '.' + x.ext).join(',') || 'none'}]`);
      continue;
    }
    usedKey[a.asset_key] = (usedKey[a.asset_key] || 0) + 1;
    resolved++;
    resolvedList.push({ media: e.media, mediaExt: e.mediaExt, question_id: q.id, paper_id, qn: Number(qn), asset_key: a.asset_key, targetExt: a.ext, storage_path: a.storage_path, public_url: a.public_url, role: e.role, optKey: e.optKey });
    if (a.ext !== e.mediaExt) extNote.push(`${a.asset_key}: src=${e.mediaExt} -> targetExt=${a.ext}`);
  }
  for (const [key, n] of Object.entries(usedKey)) if (n > 1) collisions.push(`${key}: ${n} images mapped to same asset`);
  const covered = new Set(Object.keys(usedKey));
  for (const a of assets) if (!covered.has(a.asset_key)) uncovered.push(`${a.asset_key.split('__').pop()}.${a.ext} (${paper_id} Q${qn} role=${a.role}${a.option_key || ''})`);
}
await c.end();

fs.writeFileSync(process.argv[2].replace(/\.json$/, '.resolved.json'), JSON.stringify(resolvedList, null, 1));
const extSummary = {}; for (const r of resolvedList) { const k = r.mediaExt + '->' + r.targetExt; extSummary[k] = (extSummary[k] || 0) + 1; }
console.log('resolved:', resolved, '/', map.length);
console.log('ext transitions (src->target):', JSON.stringify(extSummary));
console.log('ORPHANS (image has no matching DB asset):', orphans.length); orphans.slice(0, 40).forEach((x) => console.log('  -', x));
console.log('COLLISIONS (2+ images -> same asset):', collisions.length); collisions.slice(0, 40).forEach((x) => console.log('  -', x));
console.log('OPTION-IS-TEXT-IN-DB:', notImage.length); notImage.slice(0, 40).forEach((x) => console.log('  -', x));
console.log('NO QUESTION IN DB:', noQuestion.length); noQuestion.slice(0, 40).forEach((x) => console.log('  -', x));
console.log('UNCOVERED DB assets (kept as-is):', uncovered.length); uncovered.slice(0, 20).forEach((x) => console.log('  -', x));
