// Cross-check manual mapping against DB question_assets + options. Report before uploading.
// Usage: node scripts/ingest/manual_verify.mjs <mapping.json>
import fs from 'fs';
import pg from 'pg';
const url = fs.readFileSync('.env.local', 'utf8').match(/DATABASE_URL="?([^"\n\r]+)/)[1].trim();
const { map } = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await c.connect();

// group mapping by question
const byQ = {};
for (const m of map) { const k = m.paper_id + '||' + m.qn; (byQ[k] ||= []).push(m); }

let okCount = 0; const issues = [];
for (const [k, entries] of Object.entries(byQ)) {
  const [paper_id, qn] = k.split('||');
  const qr = await c.query('select id, has_images, correct_option, options from questions where paper_id=$1 and question_number=$2', [paper_id, Number(qn)]);
  if (!qr.rows.length) { issues.push(`NO QUESTION: ${paper_id} Q${qn}`); continue; }
  const q = qr.rows[0];
  const assets = (await c.query('select asset_key, role, option_key, ext, storage_path, public_url from question_assets where question_id=$1', [q.id])).rows;
  const assetByKey = Object.fromEntries(assets.map((a) => [a.asset_key, a]));
  const optIsImage = {}; for (const o of (q.options || [])) optIsImage[o.key] = !!o.isImage;
  for (const e of entries) {
    const key = e.target.replace(/\.png$/, '');
    const a = assetByKey[key];
    if (!a) {
      // does an asset with different ext exist?
      const alt = assets.find((x) => x.asset_key === key);
      issues.push(`MISSING ASSET: ${e.target}  (role ${e.role}${e.optKey ? ' '+e.optKey : ''})  [DB assets: ${assets.map(x=>x.asset_key.split('__').pop()+'.'+x.ext).join(',')||'none'}]`);
    } else {
      if (e.role === 'option' && optIsImage[e.optKey] === false) issues.push(`OPTION NOT IMAGE in DB: ${paper_id} Q${qn} opt${e.optKey} (DB has text option)`);
      if (a.ext !== 'png') issues.push(`EXT MISMATCH: ${e.target} DB ext=${a.ext}`);
      okCount++;
    }
  }
  // assets in DB (image) not covered by manual — informational
  const coveredKeys = new Set(entries.map((e) => e.target.replace(/\.png$/, '')));
  for (const a of assets) if (!coveredKeys.has(a.asset_key)) issues.push(`NOTE uncovered DB asset (kept as-is): ${a.asset_key.split('__').pop()}.${a.ext} (${paper_id} Q${qn})`);
}
await c.end();
console.log('matched OK:', okCount, '/', map.length);
console.log('issues/notes:', issues.length);
for (const i of issues) console.log('  -', i);
