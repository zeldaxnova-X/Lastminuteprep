// Build a self-contained verification HTML for a paper's rebuilt questions.
// Embeds local figure PNGs as base64 (proves figure crops) and renders text/LaTeX
// via KaTeX (proves transcriptions). Usage: node verify_html.mjs <paper_id> <figdir> <qn,..> <out.html>
import fs from 'fs';
import pg from 'pg';
const url = fs.readFileSync('.env.local', 'utf8').match(/DATABASE_URL="?([^"\n\r]+)/)[1].trim();
const [paper, figdir, qnList, outp] = process.argv.slice(2);
const qns = qnList.split(',').map(Number);
const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await c.connect();
const q = await c.query('select question_number qn, section, correct_option, has_images, stem, options from questions where paper_id=$1 and question_number=any($2) order by question_number', [paper, qns]);
await c.end();
const arr = (x) => (Array.isArray(x) ? x : x && Array.isArray(x.blocks) ? x.blocks : []);
const b64 = (assetId) => {
  const m = assetId.match(/__(q\d+_(?:fig|stem|opt\d+))$/) || assetId.match(/__(.+)$/);
  const name = m ? m[1] : assetId;
  for (const e of ['png', 'svg']) {
    const p = `${figdir}/${name}.${e}`;
    if (fs.existsSync(p)) return `data:image/${e === 'svg' ? 'svg+xml' : 'png'};base64,` + fs.readFileSync(p).toString('base64');
  }
  return '';
};
const blockHtml = (b) => {
  if (b.kind === 'text') return `<div class="t">${esc(b.text)}</div>`;
  if (b.kind === 'table') return `<table>${b.rows.map(r => '<tr>' + r.map(c => `<td>${esc(c)}</td>`).join('') + '</tr>').join('')}</table>`;
  if (b.kind === 'image') { const d = b64(b.assetId); return d ? `<img src="${d}">` : `<div class="miss">[img ${b.assetId}]</div>`; }
  return '';
};
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
let body = '';
for (const r of q.rows) {
  const stem = arr(r.stem).map(blockHtml).join('');
  const opts = (r.options || []).map((o) => {
    const inner = o.isImage ? arr(o.blocks).map(blockHtml).join('') : esc(o.text);
    const ok = o.key === r.correct_option;
    return `<div class="opt ${ok ? 'ok' : ''}"><b>${o.key}.</b> ${inner} ${ok ? '✓' : ''}</div>`;
  }).join('');
  body += `<div class="q"><div class="qh">Q${r.qn} <span>${r.section} · ans ${r.correct_option} · ${r.has_images ? 'has_images' : 'text-only'}</span></div>${stem}<div class="opts">${opts}</div></div>`;
}
const html = `<!doctype html><meta charset=utf8><title>${paper}</title>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.css">
<script src="https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/contrib/auto-render.min.js"></script>
<style>body{font:15px/1.5 system-ui;max-width:820px;margin:20px auto;color:#1a1a2e;padding:0 16px}
.q{border:1px solid #e3e3ef;border-radius:12px;padding:16px 18px;margin:14px 0;box-shadow:0 1px 3px rgba(0,0,0,.04)}
.qh{font-weight:700;margin-bottom:8px}.qh span{font-weight:400;color:#7a7a8c;font-size:12px}
.t{margin:6px 0}img{max-width:100%;border:1px solid #eee;border-radius:6px;margin:6px 0;background:#fff}
.opts{margin-top:10px}.opt{padding:6px 10px;border-radius:8px;margin:4px 0;background:#f7f7fb}
.opt.ok{background:#e6f7ec;border:1px solid #46b06a}.opt img{max-height:120px}
table{border-collapse:collapse;margin:6px 0}td{border:1px solid #ccc;padding:3px 8px}.miss{color:#c00}</style>
<h2>${paper}</h2><p>Rebuild verification · figures embedded from crisp local renders · math rendered as real LaTeX</p>
${body}
<script>renderMathInElement(document.body,{delimiters:[{left:'$',right:'$',display:false}]});</script>`;
fs.writeFileSync(outp, html);
console.log('wrote', outp, html.length, 'bytes');
