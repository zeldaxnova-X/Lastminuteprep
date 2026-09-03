// Apply a per-paper rebuild spec: update stem/options + refresh question_assets.
// Usage: node scripts/ingest/papply.mjs <spec.json> <figdir>
// spec.json: { "paper":"<id>", "questions": { "<qn>": {
//     "ans":"B",                      // expected correct_option (verify only)
//     "stem":[ {"text":"..."}, {"img":"q7_fig","ext":"png|svg"}, {"table":[[".."]]} ],
//     "opts":"img"                     // 4 image options q<qn>_opt1..4.png
//         | ["a","b","c","d"]          // 4 text/LaTeX options
// }}}
import fs from 'fs';
import pg from 'pg';
import crypto from 'crypto';
const url = fs.readFileSync('.env.local', 'utf8').match(/DATABASE_URL="?([^"\n\r]+)/)[1].trim();
const spec = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const figdir = process.argv[3];
const paper = spec.paper;
const B = `https://aiddngocebksoudlrvoh.supabase.co/storage/v1/object/public/question-assets/${paper}`;
const baseRoot = B.replace(/\/[^/]+$/, '');
const img = (n, e) => ({ url: `${B}/${paper}__${n}.${e}`, kind: 'image', assetId: `${paper}__${n}` });
const meta = (n, e) => { const b = fs.readFileSync(`${figdir}/${n}.${e}`); return { sha: crypto.createHash('sha256').update(b).digest('hex'), len: b.length }; };
const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await c.connect();
for (const qn of Object.keys(spec.questions)) {
  const s = spec.questions[qn];
  const stem = s.stem.map((b) => b.text !== undefined ? { kind: 'text', text: b.text } : b.table ? { kind: 'table', rows: b.table } : img(b.img, b.ext));
  const assets = [];
  const si = s.stem.find((b) => b.img);
  if (si) assets.push(['stem', null, si.img, si.ext]);
  let options, hasImg;
  if (s.opts === 'img') {
    hasImg = true;
    options = ['A', 'B', 'C', 'D'].map((k, i) => ({ key: k, text: '', index: i + 1, blocks: [img(`q${qn}_opt${i + 1}`, 'png')], isImage: true }));
    for (const i of [1, 2, 3, 4]) assets.push(['option', 'ABCD'[i - 1], `q${qn}_opt${i}`, 'png']);
  } else {
    hasImg = !!si;
    options = s.opts.map((t, i) => ({ key: 'ABCD'[i], text: t, index: i + 1, blocks: [{ kind: 'text', text: t }], isImage: false }));
  }
  const stem_text = stem.filter((b) => b.kind === 'text').map((b) => b.text).join('\n');
  const r = await c.query(
    'update questions set stem=$1::jsonb, stem_text=$2, options=$3::jsonb, has_images=$4, rebuilt_at=now() where paper_id=$5 and question_number=$6 returning id, correct_option',
    [JSON.stringify(stem), stem_text, JSON.stringify(options), hasImg, paper, Number(qn)]
  );
  const row = r.rows[0];
  if (!row) { console.log('Q' + qn + ': NOT FOUND'); continue; }
  await c.query('delete from question_assets where question_id=$1', [row.id]);
  for (const [role, ok, n, e] of assets) {
    const sp = `${paper}/${paper}__${n}.${e}`; const m = meta(n, e);
    await c.query(
      'insert into question_assets (question_id,paper_id,asset_key,role,option_key,storage_path,public_url,ext,sha256,byte_length) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
      [row.id, paper, `${paper}__${n}`, role, ok, sp, `${baseRoot}/${sp}`, e, m.sha, m.len]
    );
  }
  const ok = row.correct_option === s.ans;
  console.log('Q' + qn + ': ans=' + row.correct_option + (s.ans ? (ok ? ' OK' : ' !! exp ' + s.ans) : ''));
}
await c.end();
