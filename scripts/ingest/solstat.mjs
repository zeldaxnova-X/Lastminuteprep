// Report per-paper explanation coverage + list uncovered questions.
// Usage: node scripts/ingest/solstat.mjs <paper_id>
import fs from 'fs';
import pg from 'pg';
const url = fs.readFileSync('.env.local', 'utf8').match(/DATABASE_URL="?([^"\n\r]+)/)[1].trim();
const p = process.argv[2];
const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await c.connect();
const r = await c.query(
  `select count(*) t,
     count(*) filter (where solution_text <> '') s,
     count(*) filter (where has_images) img,
     count(*) filter (where has_images and solution_text <> '') img_sol
   from questions where paper_id=$1`, [p]);
console.log('paper:', p);
console.log(r.rows[0]);
const miss = await c.query(
  `select question_number qn, section, has_images, left(coalesce(stem_text,''),50) st
   from questions where paper_id=$1 and (solution_text='' or solution_text is null)
   order by question_number`, [p]);
for (const x of miss.rows) {
  console.log('Q' + x.qn, x.section, x.has_images ? 'IMG' : 'txt', '|', x.st.replace(/\n/g, ' '));
}
await c.end();
