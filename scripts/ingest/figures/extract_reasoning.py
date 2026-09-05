"""
Reasoning-figure extractor for scanned SSC CGL PYQ pages.

Reasoning figures (boxed series, embedded-figure, X-boxes, fold diagrams) are
part vector (the drawn boxes/lines) and part low-res raster (arrows/glyphs + the
baked stem sentence). Extracting the raster alone loses the vector boxes and
upscales blurry. Instead we RENDER THE REGION at high DPI so the vector content
rasterizes crisply, drop the baked sentence, and remove the page border lines.
DO NOT binarize the result (that is only for genuinely low-res raster line-art;
it turns crisp vector renders blocky).

See docs/pyq-ingestion-standard.md ("Reasoning figures: RENDER THE REGION").

Usage:
    from extract_reasoning import extract_stem, extract_options
    # page: a fitz.Page; qm/ans/qid rects located by the caller.
"""
from __future__ import annotations

import numpy as np
from PIL import Image, ImageChops

try:
    import fitz  # PyMuPDF
except ImportError:  # pragma: no cover
    fitz = None

ZOOM = 9  # render DPI multiplier; vector content stays crisp at any zoom


def _bands(mask):
    """Contiguous True-runs in a 1-D boolean mask as (start, end) pairs."""
    out, i, n = [], 0, len(mask)
    while i < n:
        if mask[i]:
            j = i
            while j < n and mask[j]:
                j += 1
            out.append((i, j))
            i = j
        else:
            i += 1
    return out


def _figonly(pil):
    """Drop the baked stem sentence: cut at the largest horizontal-ink gap and
    keep the lower band (sentence on top, figure below). Border-only rows are
    ignored via the width-fraction threshold."""
    a = np.array(pil.convert("L"))
    on = (a < 190).sum(axis=1) > max(2, pil.width * 0.01)
    rb = _bands(on)
    if len(rb) < 2:
        return pil
    gk = max(range(len(rb) - 1), key=lambda k: rb[k + 1][0] - rb[k][1])
    return pil.crop((0, max(0, rb[gk + 1][0] - 4), pil.width, pil.height))


def _clean_borders(pil):
    """Remove the page's thin full-height vertical border lines at the far
    left/right edges, then trim to content with a small margin."""
    a = np.array(pil.convert("L"))
    ink = a < 190
    H, W = ink.shape
    cols = ink.sum(axis=0)
    cb = _bands(cols > max(6, H * 0.02))

    def is_border(s, e):
        edge = (s <= W * 0.12) or (e >= W * 0.88)
        return edge and (e - s) < W * 0.02 and cols[s:e].max() > H * 0.55

    keep = [(s, e) for s, e in cb if not is_border(s, e)]
    if keep:
        pil = pil.crop((max(0, keep[0][0] - 12), 0, min(W, keep[-1][1] + 12), H))
    pil = _drop_edge_bleed(pil)
    bb = ImageChops.difference(
        pil.convert("RGB"), Image.new("RGB", pil.size, (255, 255, 255))
    ).getbbox()
    if bb:
        x0, y0, x1, y1 = bb
        p = 12
        pil = pil.crop(
            (max(0, x0 - p), max(0, y0 - p), min(pil.width, x1 + p), min(pil.height, y1 + p))
        )
    return pil


def _max_run(row):
    m = c = 0
    for v in row:
        if v:
            c += 1
            m = max(m, c)
        else:
            c = 0
    return m


def _drop_edge_bleed(pil):
    """Drop a top/bottom row-band that is a neighbouring option bleeding in: a
    horizontal RULE (long continuous ink run = an adjacent box edge) or a narrow
    TICK (an adjacent diamond's vertex), separated from the figure by a gap. Real
    content (e.g. an option's own O + letter row) spans wide but not continuously,
    so it is kept."""
    a = np.array(pil.convert("L"))
    ink = a < 175
    H, W = ink.shape
    on = ink.sum(axis=1) > max(4, W * 0.012)
    bs = _bands(on)
    if len(bs) < 2:
        return pil

    def is_bleed(s, e):
        if (e - s) > 0.14 * H:
            return False
        sub = ink[s:e]
        rule = max(_max_run(sub[r]) for r in range(sub.shape[0])) > 0.5 * W
        nz = np.nonzero(sub.sum(axis=0) > 0)[0]
        hspan = (nz[-1] - nz[0]) / W if len(nz) else 0
        tick = (e - s) < 0.10 * H and hspan < 0.30
        return rule or tick

    changed = True
    while changed and len(bs) >= 2:
        changed = False
        if is_bleed(*bs[0]) and (bs[1][0] - bs[0][1]) > 0.02 * H:
            bs = bs[1:]
            changed = True
            continue
        if is_bleed(*bs[-1]) and (bs[-1][0] - bs[-2][1]) > 0.02 * H:
            bs = bs[:-1]
            changed = True
    return pil.crop((0, max(0, bs[0][0] - 6), W, min(H, bs[-1][1] + 6)))


def _render(page, rect, zoom=ZOOM):
    pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), clip=rect)
    return Image.frombytes("RGB", [pix.width, pix.height], pix.samples)


def extract_stem(page, qm, ans, zoom=ZOOM):
    """Crisp stem figure. `qm`/`ans` are the `Q.N` and `Ans` rects. The baked
    sentence must be authored separately as a text block (it is not in the text
    layer)."""
    reg = fitz.Rect(0, qm.y0 - 1, page.rect.width, ans.y0)
    return _clean_borders(_figonly(_render(page, reg, zoom)))


def extract_options(page, ans, qid, markers, zoom=ZOOM):
    """Crisp option figures. `markers` = the sorted `1.`-`4.` rects. Each option
    is cropped at the MIDPOINTS between consecutive markers, which land in the gap
    between adjacent figures — so the whole figure is kept (all of its separate
    elements) without clipping and without the next option bleeding in. Any
    residual neighbour edge/tick is removed by `_drop_edge_bleed` inside
    `_clean_borders`. (A marker-offset window fails: box options sit centred on
    the marker, multi-element options like arrow+circle+letter get split, and
    tall boxes bleed the neighbour.)"""
    ys = [m.y0 for m in markers]
    gaps = [ys[i + 1] - ys[i] for i in range(len(ys) - 1)]
    sp = float(np.median(gaps)) if gaps else 70.0
    out = []
    for i, m in enumerate(markers):
        top = (ys[i - 1] + ys[i]) / 2 if i > 0 else ys[i] - sp * 0.5
        bot = (ys[i] + ys[i + 1]) / 2 if i + 1 < len(ys) else ys[i] + sp * 0.5
        top = max(top, ans.y1)
        bot = min(bot, qid.y0 - 1)
        reg = fitz.Rect(m.x1 + 2, top, page.rect.width, bot)
        out.append(_clean_borders(_render(page, reg, zoom)))
    return out
