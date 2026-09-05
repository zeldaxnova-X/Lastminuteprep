"""Inspect a 2024 paper: for given global Q.Ns, print the located region, the
stem text pulled from the PDF, whether options look like text or figures, and
render a labelled crop so we can eyeball layout before building the extractor.

Usage: python inspect2024.py <pdf> <outdir> <qn,qn,...>
"""
import sys, os
import fitz
sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from audit_keys_qn import all_q_positions

pdf, outdir = sys.argv[1], sys.argv[2]
qns = [int(x) for x in sys.argv[3].split(',')]
os.makedirs(outdir, exist_ok=True)
doc = fitz.open(pdf)
pos = all_q_positions(doc)
ZOOM = 4
for n in qns:
    if n not in pos:
        print(f'Q{n}: NOT FOUND'); continue
    pno, rect = pos[n]
    page = doc[pno]
    nxt = pos.get(n + 1)
    bot = nxt[1].y0 if (nxt and nxt[0] == pno) else page.rect.height
    region = fitz.Rect(0, rect.y0 - 2, page.rect.width, bot)
    txt = page.get_text(clip=region).replace('\n', ' / ').strip()
    # count images intersecting region
    imgs = [b for b in page.get_text('dict')['blocks'] if b.get('type') == 1
            and fitz.Rect(b['bbox']).intersects(region)]
    drawings = [d for d in page.get_drawings() if fitz.Rect(d['rect']).intersects(region)]
    print(f'\n=== Q{n} (page {pno}, y {rect.y0:.0f}-{bot:.0f}) rasterImgs={len(imgs)} vectorDraws={len(drawings)} ===')
    print('TEXT:', txt[:400])
    pix = page.get_pixmap(matrix=fitz.Matrix(ZOOM, ZOOM), clip=region)
    pix.save(os.path.join(outdir, f'q{n}.png'))
doc.close()
print('\nsaved crops to', outdir)
