// Apply hand-authored explanations to the DB. Writes solution_text (plain) and
// solution (a blocks array, same shape as stem, so QuestionContent renders it;
// KaTeX handles $...$ / $$...$$). Explanations justify the ALREADY-VERIFIED key.
// Usage: node scripts/ingest/solapply.mjs <sol.json>
//   sol.json = { "paper":"<id>", "sol": { "<qn>": "explanation text with $..$", ... } }
import fs from 'fs';
import pg from 'pg';
const url = fs.readFileSync('.env.local', 'utf8').match(/DATABASE_URL="?([^"\n\r]+)/)[1].trim();
const spec = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await c.connect();
let ok = 0, miss = 0;
for (const [qn, text] of Object.entries(spec.sol)) {
  const t = String(text).trim();
  // split on blank lines into paragraph blocks for clean rendering; keep $..$/$$..$$ intact
  const blocks = t.split(/\n{2,}/).map((p) => ({ kind: 'text', text: p.trim() })).filter((b) => b.text);
  const r = await c.query(
    'update questions set solution=$1::jsonb, solution_text=$2, updated_at=now() where paper_id=$3 and question_number=$4 returning id',
    [JSON.stringify(blocks), t, spec.paper, Number(qn)]
  );
  if (r.rowCount) ok++; else { miss++; console.log('Q' + qn + ': NOT FOUND'); }
}
await c.end();
console.log(`applied ${ok} explanations` + (miss ? `, ${miss} missing` : ''));
