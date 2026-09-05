// Show current DB representation of specific questions.
// Usage: node showq.mjs <paper_id> <qn,qn,...>
import fs from 'fs';
import pg from 'pg';
const url = fs.readFileSync('.env.local', 'utf8').match(/DATABASE_URL="?([^"\n\r]+)/)[1].trim();
const paper = process.argv[2];
const qns = process.argv[3].split(',').map(Number);
const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await c.connect();
const q = await c.query(
  'select question_number qn, correct_option, has_images, stem, options, stem_text from questions where paper_id=$1 and question_number = any($2) order by question_number',
  [paper, qns]
);
await c.end();
for (const r of q.rows) {
  console.log('\n===== Q' + r.qn, '| ans', r.correct_option, '| has_images', r.has_images, '=====');
  console.log('stem_text:', JSON.stringify(r.stem_text || '').slice(0, 200));
  console.log('stem:', JSON.stringify(r.stem).slice(0, 500));
  console.log('options:', JSON.stringify(r.options).slice(0, 600));
}
