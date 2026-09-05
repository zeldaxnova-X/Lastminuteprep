"""
Figure extractor for the 2024 CLEAN DIGITAL papers (section+local Q.N numbering,
green-tick answer keys, real stem text in the layer). Reuses the proven region
renderers from extract_reasoning, adds:
  * global-Q.N location via audit_keys_qn.all_q_positions (section+local map),
  * a watermark remover (whitens the pink 'Adda247'/'A' overlay) so figure crops
    are clean black-on-white line art,
  * option-figure crops by marker rows (2024 options stack vertically; the figure
    sits to the RIGHT of each 1./2./3./4. marker).

Usage:
  python extract2024.py <pdf> <paper_id> <outdir> <spec.json>
where spec.json = { "<qn>": {"opts":"img"|"text"}, ... } listing the FIG questions
(the ones whose stem carries a genuine figure). "opts":"img" also crops the 4
option figures; "opts":"text" crops only the stem figure.
Writes q<qn>_fig.png and (for opts:img) q<qn>_opt1..4.png into <outdir>, and
prints the detected green-tick answer per qn for cross-checking.
"""
from __future__ import annotations
import sys, os, json
import numpy as np
from PIL import Image
import fitz

sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from extract_reasoning import _render, ZOOM
from audit_keys_qn import all_q_positions, detect


def _dewatermark(pil):
    """Whiten the LIGHT reddish/pink 'Adda247'/'A' watermark only. It is red-
    dominant and light (both green and blue channels high); saturated chart colours
    (dark, low-channel) and black line art (R=G=B) are preserved, so coloured pie /
    bar charts survive intact."""
    a = np.array(pil.convert('RGB')).astype(int)
    r, g, b = a[:, :, 0], a[:, :, 1], a[:, :, 2]
    watermark = (r - g > 8) & (r - b > 8) & (g > 135) & (b > 135)
    a[watermark] = [255, 255, 255]
    return Image.fromarray(a.astype(np.uint8), 'RGB')


def _content_top(page, qtop, ay):
    """Y where the figure begins = the topmost near-BLACK drawing (or a modest
    raster image) in [qtop, ay]. SSC figures are pure black line art, so requiring
    dark stroke/fill excludes the tinted 'Adda247' watermark, whose vector paths
    span the whole page; prose above the figure is text-only and excluded too."""
    region_h = max(ay - qtop, 1)
    region_area = region_h * page.rect.width
    top = None
    for d in page.get_drawings():
        r = fitz.Rect(d['rect'])
        if r.y1 < qtop or r.y0 > ay:
            continue
        if r.height > region_h * 0.9 and r.width < 3:
            continue  # vertical page border
        if r.width > page.rect.width * 0.9 and r.height < 3:
            continue  # horizontal separator
        col, fill = d.get('color'), d.get('fill')
        dark = (col is not None and max(col) < 0.40) or (fill is not None and max(fill) < 0.40)
        if not dark:
            continue  # only near-black line art counts (skips tinted watermark)
        y = max(r.y0, qtop)
        top = y if top is None else min(top, y)
    for b in page.get_text('dict', clip=fitz.Rect(0, qtop, page.rect.width, ay))['blocks']:
        if b.get('type') == 1:
            r = fitz.Rect(b['bbox'])
            if r.width * r.height > region_area * 0.55:
                continue  # page-spanning watermark image
            top = min(top, max(r.y0, qtop)) if top is not None else max(r.y0, qtop)
    return top if top is not None else qtop


def _kill_edge_borders(pil):
    """Whiten the page's THIN full-height vertical border lines near the left/right
    edges. A border is a narrow (<1.5% width) run of tall ink columns; wide clusters
    of tall columns are real content (e.g. glyphs in a short option row) and kept."""
    a = np.array(pil.convert('L'))
    ink = a < 205  # catch light-gray page frame lines too
    H, W = ink.shape
    tall = ink.sum(axis=0) > 0.6 * H
    maxrun = max(4, int(W * 0.02))
    rgb = np.array(pil.convert('RGB'))
    x = 0
    while x < W:
        if tall[x]:
            j = x
            while j < W and tall[j]:
                j += 1
            run_w = j - x
            near_edge = (x < W * 0.18) or (j > W * 0.82)
            if run_w <= maxrun and near_edge:
                rgb[:, x:j] = 255
            x = j
        else:
            x += 1
    return Image.fromarray(rgb, 'RGB')


def _trim(pil, pad=16):
    """Crop to the bounding box of content = dark ink OR any coloured pixel (the
    watermark is already removed, so remaining colour is genuine chart fill, incl.
    light pastel pie sectors that are lighter than the dark-ink threshold)."""
    a = np.array(pil.convert('RGB')).astype(int)
    gray = a.mean(axis=2)
    spread = a.max(axis=2) - a.min(axis=2)
    ink = (gray < 180) | (spread > 28)
    ys = np.where(ink.any(axis=1))[0]
    xs = np.where(ink.any(axis=0))[0]
    if len(xs) == 0 or len(ys) == 0:
        return pil.crop((0, 0, 1, 1))
    return pil.crop((max(0, xs[0] - pad), max(0, ys[0] - pad),
                     min(pil.width, xs[-1] + pad), min(pil.height, ys[-1] + pad)))


def _prose_bottom(page, qtop, ay):
    """Y at the bottom of the stem PROSE paragraph. Prose is the run of left-margin
    text lines starting at the top, tightly spaced; the figure sits below it. A
    figure-internal label (Eat, O, 12032) is either separated by a gap or indented,
    so the run stops before it and the labels stay inside the figure crop."""
    lines = []
    d = page.get_text('dict', clip=fitz.Rect(0, qtop, page.rect.width, ay))
    for b in d['blocks']:
        if b.get('type') != 0:
            continue
        for ln in b.get('lines', []):
            spans = ln['spans']
            x0 = min(s['bbox'][0] for s in spans)
            y0 = min(s['bbox'][1] for s in spans)
            y1 = max(s['bbox'][3] for s in spans)
            txt = ''.join(s['text'] for s in spans).strip()
            if txt:
                lines.append((y0, y1, x0, txt))
    if not lines:
        return qtop
    lines.sort()
    W = page.rect.width
    # Margin is RELATIVE to the question's own left edge (min text x0), so indented
    # papers work too. Prose sits at this left edge; figure labels are more indented.
    qleft = min(x0 for _, _, x0, _ in lines)
    margin = qleft + W * 0.06
    bottom = lines[0][1]
    lh = lines[0][1] - lines[0][0]
    for y0, y1, x0, txt in lines[1:]:
        gap = y0 - bottom
        if x0 <= margin and gap < 0.9 * max(lh, 6):
            bottom = y1
        else:
            break
    return bottom


def _region_markers(page, top_y, bot_y):
    """Locate the 'Ans' label and the four option markers in [top_y, bot_y]. Match
    the STANDALONE word 'Ans' (via word tokens), not a substring — search_for is
    case-insensitive and also hits 'ans' inside 'answer' mid-line. Word-exact match
    also survives indented papers where the label is not near the page's left edge."""
    anss = [fitz.Rect(w[:4]) for w in page.get_text('words')
            if w[4] == 'Ans' and top_y - 2 <= w[1] <= bot_y]
    if not anss:  # fallback: rare OCR split ('A' + 'ns'); take left-margin 'Ans' hit
        qx = min((w[0] for w in page.get_text('words') if top_y - 2 <= w[1] <= bot_y), default=0)
        anss = [x for x in page.search_for('Ans')
                if top_y - 2 <= x.y0 <= bot_y and x.x0 < qx + page.rect.width * 0.06]
    ay = min((x.y0 for x in anss), default=None)
    ay1 = min(anss, key=lambda x: x.y0).y1 if anss else top_y
    markers = []
    for i, mk in enumerate(['1.', '2.', '3.', '4.']):
        rs = [r for r in page.search_for(mk)
              if (ay or top_y) - 3 <= r.y0 <= bot_y and r.x0 < page.rect.width * 0.55]
        if rs:
            markers.append(min(rs, key=lambda r: r.y0))
    markers.sort(key=lambda r: r.y0)
    return ay, ay1, markers


def _clean(img):
    return _trim(_kill_edge_borders(_dewatermark(img)))


def _dominant_image(page, qtop, bot):
    """The largest embedded raster image in [qtop, bot] IF it occupies >25% of the
    region (a chart/photo/diagram). Returns its rect, else None. This isolates a
    chart that sits between prose blocks, which the prose-cut cannot do."""
    region_area = max(bot - qtop, 1) * page.rect.width
    best, barea = None, 0
    for b in page.get_text('dict', clip=fitz.Rect(0, qtop, page.rect.width, bot))['blocks']:
        if b.get('type') != 1:
            continue
        r = fitz.Rect(b['bbox'])
        a = r.width * r.height
        if barea < a < region_area * 0.94:
            best, barea = r, a
    return best if best is not None and barea > region_area * 0.25 else None


def _prose_resume(page, top, ay):
    """Y of the first WIDE prose line below `top` (a trailing 'the question that
    follows' sentence that sits under a vector figure). Returns ay if none, so the
    figure crop stops just above the trailing question instead of swallowing it."""
    W = page.rect.width
    best = ay
    d = page.get_text('dict', clip=fitz.Rect(0, top, W, ay))
    allx = [s['bbox'][0] for b in d['blocks'] if b.get('type') == 0
            for ln in b.get('lines', []) for s in ln['spans']]
    qleft = min(allx) if allx else 0
    for b in d['blocks']:
        if b.get('type') != 0:
            continue
        for ln in b.get('lines', []):
            xs = [s['bbox'][0] for s in ln['spans']] + [s['bbox'][2] for s in ln['spans']]
            y0 = min(s['bbox'][1] for s in ln['spans'])
            txt = ''.join(s['text'] for s in ln['spans']).strip()
            if (max(xs) - min(xs)) > W * 0.40 and len(txt) > 22 and min(xs) < qleft + W * 0.06:
                best = min(best, y0)
    return best


def extract_stem_fig(page, qtop, ay, bot=None):
    di = _dominant_image(page, qtop, ay)
    if di is not None:
        reg = fitz.Rect(di.x0 - 3, di.y0 - 3, di.x1 + 3, di.y1 + 3)
    else:
        ftop = _prose_bottom(page, qtop, ay)
        fbot = _prose_resume(page, ftop + 10, ay)
        reg = fitz.Rect(0, ftop + 1, page.rect.width, fbot)
    return _clean(_render(page, reg, ZOOM))


def extract_opt_figs(page, ay, bot, markers):
    """Crop each option figure by its marker row. NOTE: in the 2024 layout the
    'Ans' label shares option 1's row, so the top floor is 'Ans' TOP (ay), not its
    bottom — clamping to the bottom would slice option 1's glyphs."""
    ys = [m.y0 for m in markers]
    gaps = [ys[i + 1] - ys[i] for i in range(len(ys) - 1)]
    sp = float(np.median(gaps)) if gaps else 70.0
    out = []
    for i, m in enumerate(markers):
        top = (ys[i - 1] + ys[i]) / 2 if i > 0 else ys[i] - sp * 0.5
        bt = (ys[i] + ys[i + 1]) / 2 if i + 1 < len(ys) else ys[i] + sp * 0.55
        top = max(top, ay - 2)
        bt = min(bt, bot - 1)
        img = _render(page, fitz.Rect(m.x1 + 2, top, page.rect.width, bt), ZOOM)
        out.append(_clean(img))
    return out


def main():
    pdf, paper_id, outdir, specpath = sys.argv[1:5]
    spec = json.load(open(specpath, encoding='utf-8'))
    os.makedirs(outdir, exist_ok=True)
    doc = fitz.open(pdf)
    pos = all_q_positions(doc)
    for qn_s, cfg in spec.items():
        qn = int(qn_s)
        if qn not in pos:
            print(f'Q{qn}: NOT FOUND'); continue
        pno, rect = pos[qn]
        page = doc[pno]
        nxt = pos.get(qn + 1)
        bot = nxt[1].y0 if (nxt and nxt[0] == pno) else page.rect.height
        ay, ay1, markers = _region_markers(page, rect.y0, bot)
        if ay is None:
            print(f'Q{qn}: no Ans found'); continue
        ans = detect(page, rect.y0, bot, page.rect.width)
        stem = extract_stem_fig(page, rect.y0, ay, bot)
        note = f'Q{qn}: tick={ans} stem={stem.width}x{stem.height}'
        if stem.width < 6 or stem.height < 6:
            note += ' !!EMPTY-STEM'
        else:
            stem.save(os.path.join(outdir, f'q{qn}_fig.png'))
        if cfg.get('opts') == 'img':
            if len(markers) != 4:
                note += f' !!opt-markers={len(markers)}'
            for i, im in enumerate(extract_opt_figs(page, ay, bot, markers), 1):
                if im.width < 6 or im.height < 6:
                    note += f' !!EMPTY-opt{i}'
                    continue
                im.save(os.path.join(outdir, f'q{qn}_opt{i}.png'))
            note += f' opts={len(markers)}'
        print(note)
    doc.close()


if __name__ == '__main__':
    main()
