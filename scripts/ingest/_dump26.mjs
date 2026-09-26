import fs from 'fs';
import pg from 'pg';
const url = fs.readFileSync('.env.local','utf8').match(/DATABASE_URL="?([^"\n\r]+)/)[1].trim();
const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await c.connect();
const rows = (await c.query(`
  select q.id, q.paper_id, q.question_number, q.correct_option, q.stem_text, q.options, p.source_pdf, p.year, p.source_document
  from questions q join papers p on p.paper_id=q.paper_id
  join excluded_questions e on e.question_id=q.id
  order by q.paper_id, q.question_number`)).rows;
console.log('count:', rows.length);
// year distribution + source
const byYear={}; rows.forEach(r=>byYear[r.year]=(byYear[r.year]||0)+1);
console.log('by year:', JSON.stringify(byYear));
console.log('\n=== full dump ===');
for (const r of rows) {
  console.log(`\n--- ${r.paper_id} Q${r.question_number} (ans ${r.correct_option}) src=${r.source_pdf||r.source_document||'?'}`);
  console.log('STEM:', (r.stem_text||'').replace(/\s+/g,' '));
  console.log('OPTS:', (r.options||[]).map(o=>`${o.key}) ${o.text}`).join('  |  '));
}
fs.writeFileSync('scripts/ingest/_26.json', JSON.stringify(rows,null,1));
await c.end();
