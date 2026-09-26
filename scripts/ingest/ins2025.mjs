// Insert parsed 2025 questions into an empty paper (transactional).
// Usage: node scripts/ingest/ins2025.mjs <parsed.json> <sourcePdfBasename> [--apply]
import fs from 'fs';
import pg from 'pg';
const url = fs.readFileSync('.env.local', 'utf8').match(/DATABASE_URL="?([^"\n\r]+)/)[1].trim();
const spec = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const srcBase = process.argv[3];               // e.g. SSC-CGL-12-Sep-2025-S1-English  (without .pdf)
const APPLY = process.argv.includes('--apply');
const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await c.connect();

// resolve paper_id via source_pdf (with or without .pdf) or paper_name_original
const pr = await c.query(
  `select paper_id, total_questions, published from papers
   where year=2025 and (source_pdf=$1 or source_pdf=$2 or paper_name_original=$1 or paper_name_original=$2)`,
  [srcBase, srcBase + '.pdf']);
if (pr.rows.length !== 1) { console.log('PAPER RESOLVE FAILED for', srcBase, '->', pr.rows.map(r => r.paper_id)); await c.end(); process.exit(1); }
const paper = pr.rows[0].paper_id;
const existing = Number((await c.query('select count(*) n from questions where paper_id=$1', [paper])).rows[0].n);
console.log(`paper ${paper}  existing questions: ${existing}  parsed: ${spec.questions.length}  [${APPLY ? 'APPLY' : 'DRY-RUN'}]`);
if (existing > 0) { console.log('  ABORT: paper already has questions (avoid dup). Use a cleanup if re-ingesting.'); await c.end(); process.exit(1); }

const rows = spec.questions.map((q) => {
  const stemBlocks = [{ kind: 'text', text: q.stem }];
  const options = ['A', 'B', 'C', 'D'].map((k, i) => ({ key: k, text: q.options[k] || '', index: i + 1, blocks: [{ kind: 'text', text: q.options[k] || '' }], isImage: false }));
  return { qn: q.qn, section: q.section, stem: stemBlocks, stem_text: q.stem, options, ans: q.answer };
});

if (!APPLY) {
  console.log('  sample Q1:', JSON.stringify(rows[0]).slice(0, 160));
  console.log('  would insert', rows.length, 'rows; set papers.total_questions=' + rows.length);
  await c.end(); process.exit(0);
}

try {
  await c.query('BEGIN');
  for (const r of rows) {
    await c.query(
      `insert into questions (paper_id, question_number, external_id, section, language, stem, stem_text, options, has_images, correct_option, answer_source, answer_status, needs_answer_key, source_document, dataset_version)
       values ($1,$2,$3,$4,'en',$5::jsonb,$6,$7::jsonb,false,$8,'solved_paper','answered',false,$9,'2025.1')`,
      [paper, r.qn, `${paper}-${r.qn}`, r.section, JSON.stringify(r.stem), r.stem_text, JSON.stringify(r.options), r.ans, srcBase + '.pdf']);
  }
  await c.query("update papers set total_questions=$1, tier='Tier 1', updated_at=now() where paper_id=$2", [rows.length, paper]);
  await c.query('COMMIT');
  console.log('  INSERTED', rows.length, 'questions; total_questions set.');
} catch (e) { await c.query('ROLLBACK'); console.log('  ROLLBACK:', e.message); }
await c.end();
