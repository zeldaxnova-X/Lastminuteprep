import fs from 'fs';
import pg from 'pg';
const url = fs.readFileSync('.env.local', 'utf8').match(/DATABASE_URL="?([^"\n\r]+)/)[1].trim();
const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await c.connect();
const yr = await c.query(`
  select
    case when paper_id like '%2022%' then '2022'
         when paper_id like '%2023%' then '2023'
         when paper_id like '%2024%' then '2024'
         when paper_id like '%2025%' then '2025' else 'other' end yr,
    count(*) imgq
  from questions where has_images = true group by 1 order by 1`);
console.log('image questions by year:', JSON.stringify(yr.rows));
const tot = await c.query('select count(*) n from questions where has_images = true');
console.log('total image questions:', tot.rows[0].n);
const asset = await c.query('select role, count(*) n from question_assets group by role order by role');
console.log('question_assets by role:', JSON.stringify(asset.rows));
const withAssets = await c.query('select count(distinct question_id) n from question_assets');
console.log('distinct questions with asset rows:', withAssets.rows[0].n);
const s = await c.query(`select q.id, q.paper_id, q.question_number, q.section, q.correct_option, q.options, q.stem
  from questions q where q.has_images = true and q.paper_id like '%2024-2024-09-09-shift-1' order by q.question_number limit 2`);
for (const r of s.rows) {
  console.log('\n--- Q' + r.question_number, r.section, 'ans', r.correct_option);
  console.log('stem:', JSON.stringify(r.stem).slice(0, 300));
  console.log('options:', JSON.stringify(r.options).slice(0, 400));
  const a = await c.query('select role, option_key, public_url, ext from question_assets where question_id=$1', [r.id]);
  console.log('assets:', JSON.stringify(a.rows));
}
await c.end();
