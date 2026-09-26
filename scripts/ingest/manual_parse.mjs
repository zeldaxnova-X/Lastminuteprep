// Parse manualretrieval.docx: map each embedded image -> {paper_id, qn, role, optKey, targetAsset}.
// Usage: node scripts/ingest/manual_parse.mjs <unzippedDocxDir> <outJson>
import fs from 'fs';
import path from 'path';

const dir = process.argv[2];
const outJson = process.argv[3];
const xml = fs.readFileSync(path.join(dir, 'word/document.xml'), 'utf8');
const rels = fs.readFileSync(path.join(dir, 'word/_rels/document.xml.rels'), 'utf8');
const relMap = {};
for (const m of rels.matchAll(/Id="(rId\d+)"[^>]*Target="([^"]+)"/g)) relMap[m[1]] = m[2];

// ordered tokens
const tokens = [];
const re = /<w:t[^>]*>([^<]*)<\/w:t>|<a:blip[^>]*r:embed="(rId\d+)"/g;
let mm;
while ((mm = re.exec(xml))) {
  if (mm[1] !== undefined) tokens.push({ t: mm[1] });
  else tokens.push({ img: relMap[mm[2]] });
}

const optIdx = { A: 1, B: 2, C: 3, D: 4 };
let curPaper = null, curQ = null;
let buf = '';
const map = [];
const warnings = [];

for (const tok of tokens) {
  if (tok.img) {
    // update paper / Q from everything accumulated since last image
    let pm = [...buf.matchAll(/paper id:\s*([a-z0-9\-]+)/gi)]; if (pm.length) { curPaper = pm[pm.length - 1][1]; }
    let qm = [...buf.matchAll(/(?:^|\s)Q\s*(\d+)\b/g)]; if (qm.length) { curQ = Number(qm[qm.length - 1][1]); }
    // option label = buf ENDS with "X -" or "Option X -" (robust to run-splitting)
    const om = buf.trim().match(/(?:option\s*)?([ABCD])\s*[-–]\s*$/i);
    let role, optKey = null, targetName;
    if (!curPaper || !curQ) { warnings.push(`image ${tok.img} before paper/Q context`); buf = ''; continue; }
    if (om) { role = 'option'; optKey = om[1].toUpperCase(); targetName = `${curPaper}__q${curQ}_opt${optIdx[optKey]}.png`; }
    else { role = 'stem'; targetName = `${curPaper}__q${curQ}_fig.png`; }
    map.push({ media: tok.img, paper_id: curPaper, qn: curQ, role, optKey, target: targetName });
    buf = '';
    continue;
  }
  buf += tok.t + ' ';
}

fs.writeFileSync(outJson, JSON.stringify({ map, warnings }, null, 1));
// summary
const byPaper = {}; map.forEach((m) => (byPaper[m.paper_id] ||= new Set()).add(m.qn));
console.log('images mapped:', map.length, ' warnings:', warnings.length);
console.log('questions:', Object.values(byPaper).reduce((a, s) => a + s.size, 0), ' papers:', Object.keys(byPaper).length);
const roles = {}; map.forEach((m) => roles[m.role] = (roles[m.role] || 0) + 1);
console.log('roles:', JSON.stringify(roles));
if (warnings.length) console.log('WARNINGS:', warnings.slice(0, 10));
// print per-question image counts to spot anomalies
const perQ = {}; map.forEach((m) => { const k = m.paper_id + ' Q' + m.qn; (perQ[k] ||= []).push(m.role === 'option' ? m.optKey : 'FIG'); });
for (const [k, v] of Object.entries(perQ)) console.log('  ', k, '->', v.join(','));
