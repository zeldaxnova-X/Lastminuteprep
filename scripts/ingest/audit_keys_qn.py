"""
Answer-key audit for the 2024 digital papers (no 'Question ID', global Q.N).

These papers list questions as 'Q.1' ... 'Q.100' in order, each with an 'Ans'
block whose correct option carries a GREEN tick (wrong = red cross), left of the
option number. This locates each Q.N, bounds it by the next Q.(N+1), and reads
the tick colour -> source-verified answer.

Usage: python scripts/ingest/audit_keys_qn.py <source_pdf> [out.json]
Writes/prints { "<n>": "A|B|C|D|?" } for n = 1..100.
"""
from __future__ import annotations
import sys, json
import fitz
import numpy as np


def all_q_positions(doc):
    """The 2024 papers number Q.1..Q.25 PER SECTION (4 sections in order:
    reasoning, GA, quant, English). Collect every 'Q.<n>' in document reading
    order and map to a GLOBAL 1..100 by sequence, so global = (section-1)*25 + n.
    Returns {global_qn: (page_index, rect)}."""
    seq = []
    for pno in range(doc.page_count):
        page = doc[pno]
        for w in page.get_text('words'):
            t = w[4]
            if t.startswith('Q.') and t[2:].isdigit() and 1 <= int(t[2:]) <= 25:
                seq.append((pno, w[1], w[0], int(t[2:]), fitz.Rect(w[0], w[1], w[2], w[3])))
    seq.sort(key=lambda e: (e[0], e[1], e[2]))
    # de-dup accidental double hits of the same label (same page,y,local n within 2px)
    dedup = []
    for e in seq:
        if dedup and dedup[-1][0] == e[0] and abs(dedup[-1][1] - e[1]) < 2 and dedup[-1][3] == e[3]:
            continue
        dedup.append(e)
    pos = {}
    for gi, e in enumerate(dedup[:100]):
        pos[gi + 1] = (e[0], e[4])
    return pos


def detect(page, top_y, bot_y, page_w):
    anss = [a for a in page.search_for('Ans') if top_y - 2 <= a.y0 <= bot_y]
    if not anss:
        return '?'
    ay = min(anss, key=lambda a: a.y0).y0
    marks = []
    for i, mk in enumerate(['1.', '2.', '3.', '4.']):
        rs = [r for r in page.search_for(mk) if r.y0 >= ay - 3 and r.y0 <= bot_y and r.x0 < page_w * 0.55]
        if rs:
            marks.append((i, min(rs, key=lambda r: r.y0)))
    if len(marks) < 2:
        return '?'
    greens = []
    for idx, m in marks:
        clip = fitz.Rect(max(0, m.x0 - 26), m.y0 - 3, m.x0 - 1, m.y1 + 3)
        if clip.width < 3 or clip.height < 3:
            greens.append(0); continue
        pix = page.get_pixmap(matrix=fitz.Matrix(3, 3), clip=clip)
        a = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)[:, :, :3].astype(int)
        r, g, b = a[:, :, 0], a[:, :, 1], a[:, :, 2]
        greens.append(int(((g > 90) & (g - r > 30) & (g - b > 20)).sum()))
    mx = max(greens)
    if mx < 8:
        return '?'
    winners = [i for i, gv in enumerate(greens) if gv >= mx * 0.6]
    return 'ABCD'[marks[winners[0]][0]] if len(winners) == 1 else '?'


def audit(pdf_path):
    doc = fitz.open(pdf_path)
    pos = all_q_positions(doc)
    out = {}
    for n in range(1, 101):
        if n not in pos:
            out[n] = '-'; continue
        pno, rect = pos[n]
        page = doc[pno]
        nxt = pos.get(n + 1)
        bot = nxt[1].y0 if (nxt and nxt[0] == pno) else page.rect.height
        out[n] = detect(page, rect.y0, bot, page.rect.width)
    doc.close()
    return out


if __name__ == '__main__':
    res = audit(sys.argv[1])
    if len(sys.argv) > 2:
        json.dump({str(k): v for k, v in res.items()}, open(sys.argv[2], 'w'))
    print('read', sum(1 for v in res.values() if v in 'ABCD'), '/ 100 | unread:',
          [k for k, v in res.items() if v not in 'ABCD'][:20])
