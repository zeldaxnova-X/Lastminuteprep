// Hybrid map of images in bigdatarefresh.docx -> target DB asset.
// Prefers the following caption filename; else derives from paper-id/Q + option-label walk.
// Usage: node scripts/ingest/bigrefresh_parse.mjs <unzippedDir> <out.json>
import fs from 'fs';
import path from 'path';
const dir = process.argv[2], out = process.argv[3];
const xml = fs.readFileSync(path.join(dir, 'word/document.xml'), 'utf8');
const rels = fs.readFileSync(path.join(dir, 'word/_rels/document.xml.rels'), 'utf8');
const relMap = {};
for (const m of rels.matchAll(/Id="(rId\d+)"[^>]*Target="([^"]+)"/g)) relMap[m[1]] = m[2];
const tokens = [];
const re = /<w:t[^>]*>([^<]*)<\/w:t>|<a:blip[^>]*r:embed="(rId\d+)"/g; let mm;
while ((mm = re.exec(xml))) { if (mm[1] !== undefined) tokens.push({ t: mm[1] }); else tokens.push({ img: relMap[mm[2]].replace(/^media\//, '') }); }

const FN = /^(ssc-cgl-[a-z0-9-]+__q\d+_(?:fig|stem|opt\d))\.(png|svg|jpg|jpeg)$/i;
const optIdx = { A: 1, B: 2, C: 3, D: 4 };
function optLabel(buf) {
  const t = buf.trim();
  let m = t.match(/\(([abcd])\)\s*(?:✓\s*correct)?\s*$/i); if (m) return m[1].toUpperCase(); // (A) / (a) ✓ correct
  m = t.match(/option\s*([abcd])\b\s*[-–:.]*\s*$/i); if (m) return m[1].toUpperCase();        // "Option A -", "Option c", "Option a "
  m = t.match(/(?:^|\s)([abcd])\s*[-–]\s*$/i); if (m) return m[1].toUpperCase();               // bare "A -", "b-"
  return null;
}
const OPTMARK = /^options?\s*[–\-:—]?\s*$/i; // standalone "Options" separator (not the word inside stem text)
let curPaper = null, curQ = null, buf = '', inOpt = false, optN = 0;
const map = []; const warnings = [];
for (let i = 0; i < tokens.length; i++) {
  const tk = tokens[i];
  if (tk.img) {
    const media = tk.img;
    // caption look-ahead
    let capKey = null, capExt = null;
    for (let j = i + 1; j < Math.min(i + 6, tokens.length); j++) {
      if (tokens[j].img) break;
      const tt = (tokens[j].t || '').trim();
      if (OPTMARK.test(tt) || optLabel(tt)) break; // next option starts here -> this image's caption (if any) is before it
      const m = tt.match(FN);
      if (m) { capKey = m[1]; capExt = m[2].toLowerCase(); break; }
    }
    let paper_id = curPaper, qn = curQ, role, optKey = null;
    if (capKey) {
      const km = capKey.match(/^(ssc-cgl-.+?)__q(\d+)_(fig|stem|opt(\d))$/); paper_id = km[1]; qn = Number(km[2]);
      role = km[3].startsWith('opt') ? 'option' : 'stem'; optKey = km[3].startsWith('opt') ? 'ABCD'[Number(km[4]) - 1] : null;
      if (role === 'option') optN = optIdx[optKey]; // keep sequence aligned
    } else {
      const lab = optLabel(buf);
      if (lab) { role = 'option'; optKey = lab; optN = optIdx[lab]; }
      else if (inOpt) { role = 'option'; optN++; optKey = 'ABCD'[optN - 1] || null; } // unlabeled image in options region -> next in sequence
      else role = 'stem';
    }
    if (!paper_id || !qn) { warnings.push('image ' + media + ' no paper/Q context'); buf = ''; continue; }
    map.push({ media, mediaExt: media.split('.').pop().toLowerCase(), paper_id, qn, role, optKey, capKey: capKey || null });
    buf = '';
    continue;
  }
  const s = tk.t || '';
  let pm = [...s.matchAll(/paper id:\s*([a-z0-9-]+)/gi)]; if (pm.length) { curPaper = pm[pm.length - 1][1]; curQ = null; buf = ''; inOpt = false; optN = 0; continue; }
  let qm = [...s.matchAll(/(?:^|\s)Q\s*(\d+)\b/g)]; if (qm.length) { curQ = Number(qm[qm.length - 1][1]); inOpt = false; optN = 0; }
  if (OPTMARK.test(s.trim())) { inOpt = true; optN = 0; buf = ''; continue; } // standalone Options separator
  buf += s + ' ';
}
fs.writeFileSync(out, JSON.stringify({ map, warnings }, null, 1));
const byExt = {}; map.forEach((m) => byExt[m.mediaExt] = (byExt[m.mediaExt] || 0) + 1);
const viaCap = map.filter((m) => m.capKey).length;
const qset = new Set(map.map((m) => m.paper_id + '|' + m.qn));
console.log('mapped:', map.length, '| warnings:', warnings.length, '| via caption:', viaCap, '| via label:', map.length - viaCap);
console.log('doc media ext:', JSON.stringify(byExt), '| distinct questions:', qset.size, '| papers:', new Set(map.map((m) => m.paper_id)).size);
// per-question role sanity (flag questions without stem or with dup roles)
const perQ = {}; for (const m of map) { const k = m.paper_id + '|Q' + m.qn; (perQ[k] ||= []).push(m.role === 'option' ? m.optKey : 'FIG'); }
const odd = Object.entries(perQ).filter(([k, v]) => { const opts = v.filter((x) => x !== 'FIG'); return new Set(opts).size !== opts.length || v.filter((x) => x === 'FIG').length > 1; });
console.log('questions with dup/odd roles:', odd.length); odd.slice(0, 12).forEach(([k, v]) => console.log('  ', k, '->', v.join(',')));
