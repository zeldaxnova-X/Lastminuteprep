// Upload all figure files (q*_fig.*, q*_opt*.png) from a dir to a paper's asset store.
// Usage: node scripts/ingest/upfigs.mjs <paper_id> <figdir>
import fs from 'fs';
const env = fs.readFileSync('.env.local', 'utf8');
const surl = env.match(/NEXT_PUBLIC_SUPABASE_URL="?([^"\n\r]+)/)[1].trim();
const skey = env.match(/SUPABASE_SERVICE_ROLE_KEY="?([^"\n\r]+)/)[1].trim();
const paper = process.argv[2];
const dir = process.argv[3];
const ct = (f) => f.endsWith('.svg') ? 'image/svg+xml' : f.endsWith('.png') ? 'image/png' : 'application/octet-stream';
const files = fs.readdirSync(dir).filter((f) => /^q\d+_(fig|opt\d)\.(png|svg)$/.test(f));
let ok = 0, fail = 0;
for (const f of files) {
  const buf = fs.readFileSync(dir + '/' + f);
  const path = `${paper}/${paper}__${f}`;
  const res = await fetch(`${surl}/storage/v1/object/question-assets/${path}`, { method: 'POST', headers: { apikey: skey, Authorization: 'Bearer ' + skey, 'Content-Type': ct(f), 'x-upsert': 'true' }, body: buf });
  if (res.ok) ok++; else { fail++; console.log('FAIL', f, res.status); }
}
console.log('uploaded', ok, '/', files.length, fail ? '(' + fail + ' failed)' : '');
