// Cross-check DB correct_option against a source-tick audit and fix mismatches.
// Usage: node scripts/ingest/fixkeys.mjs <paper_id> <audit.json> [--apply]
// audit.json: { "<qn>": "A|B|C|D|?|-" } from scripts/ingest/audit_keys.py
import fs from 'fs';
import pg from 'pg';
const url = fs.readFileSync('.env.local', 'utf8').match(/DATABASE_URL="?([^"\n\r]+)/)[1].trim();
const paper = process.argv[2];
const det = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
const apply = process.argv.includes('--apply');
const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await c.connect();
const q = await c.query('select question_number qn, correct_option from questions where paper_id=$1 order by question_number', [paper]);
const changes = [];
let unread = 0;
for (const r of q.rows) {
  const d = det[r.qn];
  if (!d || !'ABCD'.includes(d)) { unread++; continue; }
  if (d !== r.correct_option) {
    changes.push([r.qn, r.correct_option, d]);
    if (apply) await c.query('update questions set correct_option=$1, updated_at=now() where paper_id=$2 and question_number=$3', [d, paper, r.qn]);
  }
}
await c.end();
console.log(paper.replace('ssc-cgl-tier-1-', '') + ' | ' + (apply ? 'FIXED' : 'would fix') + ' ' + changes.length + ' | unread ' + unread + (changes.length ? ' | ' + changes.map((x) => 'Q' + x[0] + ':' + x[1] + '>' + x[2]).join(' ') : ''));
