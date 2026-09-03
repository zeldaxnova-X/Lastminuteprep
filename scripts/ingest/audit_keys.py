"""
Answer-key audit from the source response sheet's green tick.

TCS response sheets mark the correct option with a GREEN check and wrong ones
with a RED cross, to the left of each option number (1. 2. 3. 4.). This reads
that colour for every question and reports the source-verified answer, so the DB
correct_option can be cross-checked and corrected (source wins).

Usage:
    python scripts/ingest/audit_keys.py <source_pdf> <qs.json> [out.json]
qs.json: [{ "qn":int, "external_id":.. }]  (from scripts/ingest/pinfo.mjs)
Prints/writes: { "<qn>": "A|B|C|D|?"}  ('?' = couldn't read a single green tick)
"""
from __future__ import annotations
import sys, json
import fitz
import numpy as np


def detect(page, ans_y, qid_y, page_w):
    """Return 'A'/'B'/'C'/'D' or '?' for the question whose Ans is at ans_y and
    Question-ID at qid_y."""
    marks = []
    for i, mk in enumerate(['1.', '2.', '3.', '4.']):
        rs = [r for r in page.search_for(mk) if r.y0 >= ans_y - 3 and r.y1 <= qid_y + 2 and r.x0 < page_w * 0.5]
        if rs:
            marks.append((i, min(rs, key=lambda r: r.y0)))
    if len(marks) < 2:
        return '?'
    greens = []
    for idx, m in marks:
        # icon sits just left of the option number
        clip = fitz.Rect(max(0, m.x0 - 26), m.y0 - 3, m.x0 - 1, m.y1 + 3)
        if clip.width < 3 or clip.height < 3:
            greens.append(0); continue
        pix = page.get_pixmap(matrix=fitz.Matrix(3, 3), clip=clip)
        a = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)[:, :, :3].astype(int)
        r, g, b = a[:, :, 0], a[:, :, 1], a[:, :, 2]
        green = ((g > 90) & (g - r > 30) & (g - b > 20)).sum()
        greens.append(int(green))
    mx = max(greens)
    if mx < 8:
        return '?'
    winners = [i for i, gv in enumerate(greens) if gv >= mx * 0.6]
    if len(winners) != 1:
        return '?'
    return 'ABCD'[marks[winners[0]][0]]


def audit(pdf_path, qs):
    doc = fitz.open(pdf_path)
    out = {}
    for q in qs:
        ext = str(q['external_id'])
        qn = q['qn']
        found = False
        for pno in range(doc.page_count):
            page = doc[pno]
            rqs = page.search_for('Question ID : ' + ext)
            if not rqs:
                continue
            rq = rqs[0]
            anss = [a for a in page.search_for('Ans') if a.y1 <= rq.y0 + 2]
            if not anss:
                out[qn] = '?'; found = True; break
            ans = max(anss, key=lambda a: a.y0)
            out[qn] = detect(page, ans.y0, rq.y0, page.rect.width)
            found = True
            break
        if not found:
            out[qn] = '-'  # question id not in this source
    doc.close()
    return out


if __name__ == '__main__':
    pdf, qsf = sys.argv[1], sys.argv[2]
    qs = json.load(open(qsf, encoding='utf-8'))
    res = audit(pdf, qs)
    if len(sys.argv) > 3:
        json.dump({str(k): v for k, v in res.items()}, open(sys.argv[3], 'w'))
    unread = [k for k, v in res.items() if v in ('?', '-')]
    print('read', sum(1 for v in res.values() if v in 'ABCD'), '/', len(res), '| unread:', unread[:20])
    print(json.dumps({str(k): v for k, v in res.items()}))
