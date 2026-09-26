// Dump a paper's questions in compact readable form for authoring explanations.
// Usage: node scripts/ingest/dumppaper.mjs <paper_id> [onlyTextMissing]
import fs from 'fs';
import pg from 'pg';
const url = fs.readFileSync('.env.local', 'utf8').match(/DATABASE_URL="?([^"\n\r]+)/)[1].trim();
const paper = process.argv[2];
const onlyMissing = process.argv[3] === 'missing';
const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await c.connect();
const q = await c.query(
  `select question_number qn, section, correct_option, has_images, stem, options, stem_text,
     (solution_text is not null and solution_text <> '') as has_sol
   from questions where paper_id=$1 order by question_number`,
  [paper]
);
await c.end();
const blockText = (b) => b.kind === 'text' ? b.text : b.kind === 'table' ? '[TABLE]\n' + (b.rows||[]).map(r=>r.join(' | ')).join('\n') : b.kind === 'image' ? '[IMG]' : '';
for (const r of q.rows) {
  if (onlyMissing && (r.has_sol || r.has_images)) continue;
  const stem = Array.isArray(r.stem) ? r.stem.map(blockText).join('\n') : (r.stem_text||'');
  const opts = (r.options||[]).map(o => `  ${o.key}) ${o.isImage?'[IMG]':o.text}`).join('\n');
  console.log(`\n### Q${r.qn} [${r.section}] ans=${r.correct_option}${r.has_images?' IMG':''}${r.has_sol?' (has_sol)':''}`);
  console.log(stem);
  console.log(opts);
}
