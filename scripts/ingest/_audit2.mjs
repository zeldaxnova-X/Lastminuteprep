import fs from 'fs';
import pg from 'pg';
const url = fs.readFileSync('.env.local','utf8').match(/DATABASE_URL="?([^"\n\r]+)/)[1].trim();
const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await c.connect();
// High-precision "this question NEEDS a data visual" pattern.
const DI = /(pie[- ]?chart|bar[- ]?graph|bar[- ]?chart|line[- ]?graph|\bhistogram\b|table given below|table below shows|following table|the table shows|chart given below|chart below shows|the chart shows|graph given below|the graph shows|study the (given|following) (pie|bar|chart|graph|table|data)|the (following|given) (pie|bar|chart|graph))/i;
const rows = (await c.query(`select id, section, has_images, stem_text, stem from questions`)).rows;
const assets = new Set((await c.query(`select distinct question_id from question_assets where role='stem'`)).rows.map(r=>r.question_id));
const bySec={}; const incompleteIds=[];
for (const q of rows) {
  if(!DI.test(q.stem_text||'')) continue;
  const sec=q.section||'unknown'; (bySec[sec]??={refs:0,incomplete:0,samples:[]}); bySec[sec].refs++;
  const stem=Array.isArray(q.stem)?q.stem:[];
  const hasImg = stem.some(b=>b&&b.kind==='image')||assets.has(q.id)||q.has_images===true;
  const hasTable = stem.some(b=>b&&b.kind==='table');
  if(!hasImg && !hasTable){ bySec[sec].incomplete++; incompleteIds.push(q.id); if(bySec[sec].samples.length<6) bySec[sec].samples.push((q.stem_text||'').replace(/\s+/g,' ').slice(0,85)); }
}
for(const [s,v] of Object.entries(bySec)) { console.log(`\n${s}: DI-ref ${v.refs} | INCOMPLETE ${v.incomplete}`); v.samples.forEach(x=>console.log('   • '+x)); }
console.log('\nTOTAL genuinely-incomplete:', incompleteIds.length);
fs.writeFileSync('scripts/ingest/_incomplete_ids.json', JSON.stringify(incompleteIds));
await c.end();
