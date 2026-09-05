"""Compose a labelled montage of a figure dir's crops for quick visual review.
Usage: python montage.py <figdir> <out.png> [maxw]
Each q*_fig.png and its q*_opt1..4 are drawn on one row, labelled.
"""
import sys, os, re, glob
from PIL import Image, ImageDraw

figdir, outp = sys.argv[1], sys.argv[2]
MAXW = int(sys.argv[3]) if len(sys.argv) > 3 else 520
files = glob.glob(os.path.join(figdir, 'q*_fig.png'))
def qn(f): return int(re.search(r'q(\d+)_', os.path.basename(f)).group(1))
files.sort(key=qn)

def load_scaled(path, maxw, maxh):
    im = Image.open(path).convert('RGB')
    s = min(maxw / im.width, maxh / im.height, 1.0)
    return im.resize((max(1, int(im.width * s)), max(1, int(im.height * s))))

rows = []
ROWH = 150
for f in files:
    n = qn(f)
    cells = [('q%d fig' % n, load_scaled(f, MAXW, ROWH))]
    for i in range(1, 5):
        op = os.path.join(figdir, 'q%d_opt%d.png' % (n, i))
        if os.path.exists(op):
            cells.append(('o%d' % i, load_scaled(op, 240, ROWH)))
    rows.append(cells)

pad, lblh = 10, 16
rowH = ROWH + lblh + pad
totalW = max((sum(c[1].width + pad for c in row) + 60 for row in rows), default=400)
totalH = rowH * len(rows) + pad
canvas = Image.new('RGB', (totalW, totalH), (255, 255, 255))
d = ImageDraw.Draw(canvas)
y = pad
for row in rows:
    x = 5
    for lbl, im in row:
        d.text((x, y), lbl, fill=(200, 0, 0))
        canvas.paste(im, (x, y + lblh))
        d.rectangle([x, y + lblh, x + im.width, y + lblh + im.height], outline=(220, 220, 220))
        x += im.width + pad
    d.line([0, y + rowH - pad // 2, totalW, y + rowH - pad // 2], fill=(230, 230, 230))
    y += rowH
canvas.save(outp)
print('montage', canvas.width, 'x', canvas.height, '->', outp)
