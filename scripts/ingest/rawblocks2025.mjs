// Dump raw PDF text blocks for specific (paper, qn) so we can hand-author fixes.
// Usage: node scripts/ingest/rawblocks2025.mjs  (reads targets from DB: empty-option + finds gaps)
import fs from 'fs';
import { execFileSync } from 'child_process';
import pg from 'pg';
const url = fs.readFileSync('.env.local', 'utf8').match(/DATABASE_URL="?([^"\n\r]+)/)[1].trim();
const DIR = 'C:/Users/jijo1/OneDrive/Desktop/Lastmileprep latest/ssc cgl/English';
const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await c.connect();
// empty-option questions
const base = `from questions q where q.paper_id ~ '^[0-9a-f-]{36}$' and q.paper_id in (select paper_id from papers where year=2025)`;
const empty = (await c.query(`select q.paper_id, q.question_number qn, q.source_document src, q.correct_option ans ${base}
  and (q.options->0->>'text'='' or q.options->1->>'text'='' or q.options->2->>'text'='' or q.options->3->>'text'='') order by src, qn`)).rows;
// find missing qn per paper (papers with <100)
const gaps = (await c.query(`select q.paper_id, q.source_document src, array_agg(q.question_number order by q.question_number) qns
  from questions q where q.paper_id ~ '^[0-9a-f-]{36}$' and q.paper_id in (select paper_id from papers where year=2025)
  group by 1,2 having count(*)<100`)).rows;
await c.end();

const targets = empty.map(r => ({ paper_id: r.paper_id, src: r.src, qn: r.qn, ans: r.ans, kind: 'empty-option' }));
for (const g of gaps) {
  const have = new Set(g.qns);
  for (let i = 1; i <= 100; i++) if (!have.has(i)) targets.push({ paper_id: g.paper_id, src: g.src, qn: i, ans: null, kind: 'MISSING' });
}

// group by src, extract raw blocks via a small python helper
const bySrc = {};
for (const t of targets) (bySrc[t.src] ||= []).push(t);
const py = `
import fitz, re, json, sys
src=sys.argv[1]; qns=json.loads(sys.argv[2])
d=fitz.open(src); full="\\n".join(pg.get_text() for pg in d)
out={}
for qn in qns:
    m=re.search(r'(?s)Q'+str(qn)+r'\\.(.*?)(?:Q'+str(qn+1)+r'\\.|$)', full)
    out[qn]=(m.group(0)[:900] if m else '')
print(json.dumps(out, ensure_ascii=False))
`;
fs.writeFileSync('scripts/ingest/_rawblk.py', py);
const result = {};
for (const [src, ts] of Object.entries(bySrc)) {
  const pdf = `${DIR}/${src}`;
  const qns = ts.map(t => t.qn);
  const outJson = execFileSync('python', ['scripts/ingest/_rawblk.py', pdf, JSON.stringify(qns)], { encoding: 'utf8', maxBuffer: 1e7, env: { ...process.env, PYTHONIOENCODING: 'utf-8' } });
  const blocks = JSON.parse(outJson);
  for (const t of ts) result[`${src} | Q${t.qn}`] = { kind: t.kind, ans: t.ans, paper_id: t.paper_id, raw: blocks[t.qn] };
}
const outPath = 'C:/Users/jijo1/AppData/Local/Temp/claude/C--Users-jijo1-OneDrive-Desktop-Lastmileprep/e444d752-aabc-46fe-af74-5a2e83e5dc78/scratchpad/p2025/rawfix.json';
fs.writeFileSync(outPath, JSON.stringify(result, null, 1));
console.log('wrote', Object.keys(result).length, 'raw blocks ->', outPath);
