// Convert the two text questions (2022-12-03-shift-1 Q24, Q25) into figure questions
// using the manually-cropped HD images: upload stem+4 option images, rewire stem/options jsonb,
// set has_images + correct_option, and insert question_assets rows.
// Usage: node scripts/ingest/manual_convert.mjs <unzippedDocxDir> <mapping.json> [--apply]
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import pg from 'pg';
import sharp from 'sharp';

const dir = process.argv[2];
const { map } = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
const APPLY = process.argv.includes('--apply');
const env = fs.readFileSync('.env.local', 'utf8');
const DBURL = env.match(/DATABASE_URL="?([^"\n\r]+)/)[1].trim();
const SURL = env.match(/NEXT_PUBLIC_SUPABASE_URL="?([^"\n\r]+)/)[1].trim();
const SKEY = env.match(/SUPABASE_SERVICE_ROLE_KEY="?([^"\n\r]+)/)[1].trim();
const BASE = 'https://aiddngocebksoudlrvoh.supabase.co/storage/v1/object/public/question-assets';

const PAPER = 'ssc-cgl-tier-1-2022-2022-12-03-shift-1';
const targets = {
  24: { ans: 'C', stem: 'Select the option figure that is embedded in the given figure. (Rotation is NOT allowed.)' },
  25: { ans: 'A', stem: 'Select the figure from the options that can replace the question mark (?) and complete the given pattern.' },
};
const optIdxToKey = { 1: 'A', 2: 'B', 3: 'C', 4: 'D' };
const keyToIdx = { A: 1, B: 2, C: 3, D: 4 };

const c = new pg.Client({ connectionString: DBURL, ssl: { rejectUnauthorized: false } });
await c.connect();

async function upload(storagePath, buf) {
  const res = await fetch(`${SURL}/storage/v1/object/question-assets/${storagePath}`, {
    method: 'POST', headers: { apikey: SKEY, Authorization: 'Bearer ' + SKEY, 'Content-Type': 'image/png', 'x-upsert': 'true' }, body: buf });
  if (!res.ok) throw new Error('upload ' + res.status + ' ' + (await res.text()).slice(0, 120));
}

for (const [qnStr, cfg] of Object.entries(targets)) {
  const qn = Number(qnStr);
  const q = (await c.query('select id, has_images, correct_option from questions where paper_id=$1 and question_number=$2', [PAPER, qn])).rows[0];
  if (!q) { console.log('NO QUESTION', PAPER, qn); continue; }
  const entries = map.filter((m) => m.paper_id === PAPER && m.qn === qn);
  const stemE = entries.find((e) => e.role === 'stem');
  const optE = {}; entries.filter((e) => e.role === 'option').forEach((e) => optE[e.optKey] = e);
  const missing = ['A', 'B', 'C', 'D'].filter((k) => !optE[k]);
  if (!stemE || missing.length) { console.log('INCOMPLETE Q' + qn, 'stem?', !!stemE, 'missingOpts', missing); continue; }

  // read + validate all 5 images
  const files = {};
  for (const e of [stemE, optE.A, optE.B, optE.C, optE.D]) {
    const p = path.join(dir, 'word', e.media.replace(/^media\//, 'media/'));
    const buf = fs.readFileSync(p);
    const meta = await sharp(buf).metadata();
    files[e === stemE ? 'fig' : 'opt' + keyToIdx[e.optKey]] = { buf, meta, sha: crypto.createHash('sha256').update(buf).digest('hex') };
  }
  const names = { fig: `${PAPER}__q${qn}_fig`, opt1: `${PAPER}__q${qn}_opt1`, opt2: `${PAPER}__q${qn}_opt2`, opt3: `${PAPER}__q${qn}_opt3`, opt4: `${PAPER}__q${qn}_opt4` };

  console.log(`\nQ${qn}  ans ${cfg.ans}  (was ${q.has_images ? 'image' : 'TEXT'}, key ${q.correct_option})`);
  for (const k of ['fig', 'opt1', 'opt2', 'opt3', 'opt4']) console.log(`   ${names[k]}.png  ${files[k].meta.width}x${files[k].meta.height}  ${(files[k].buf.length/1024).toFixed(0)}KB`);
  if (!APPLY) continue;

  // upload
  for (const k of ['fig', 'opt1', 'opt2', 'opt3', 'opt4']) await upload(`${PAPER}/${names[k]}.png`, files[k].buf);

  // build jsonb
  const img = (n) => ({ url: `${BASE}/${PAPER}/${n}.png`, kind: 'image', assetId: n });
  const stem = [{ kind: 'text', text: cfg.stem }, img(names.fig)];
  const options = [1, 2, 3, 4].map((i) => ({ key: optIdxToKey[i], text: '', index: i, blocks: [img(names['opt' + i])], isImage: true }));
  await c.query('update questions set stem=$1::jsonb, stem_text=$2, options=$3::jsonb, has_images=true, correct_option=$4, updated_at=now() where id=$5',
    [JSON.stringify(stem), cfg.stem, JSON.stringify(options), cfg.ans, q.id]);

  // question_assets: clear + insert
  await c.query('delete from question_assets where question_id=$1', [q.id]);
  const baseRoot = BASE;
  const rows = [['stem', null, 'fig'], ['option', 'A', 'opt1'], ['option', 'B', 'opt2'], ['option', 'C', 'opt3'], ['option', 'D', 'opt4']];
  for (const [role, ok, k] of rows) {
    const sp = `${PAPER}/${names[k]}.png`;
    await c.query('insert into question_assets (question_id,paper_id,asset_key,role,option_key,storage_path,public_url,ext,sha256,byte_length) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
      [q.id, PAPER, names[k], role, ok, sp, `${baseRoot}/${sp}`, 'png', files[k].sha, files[k].buf.length]);
  }
  console.log(`   APPLIED Q${qn}: stem+4 image options, has_images=true, key=${cfg.ans}, 5 assets inserted`);
}
await c.end();
console.log('\n' + (APPLY ? 'done.' : 'dry-run — re-run with --apply.'));
