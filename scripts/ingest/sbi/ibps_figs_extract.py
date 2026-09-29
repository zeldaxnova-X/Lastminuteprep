# Extract clean, watermark-free DI figures for the IBPS gated DI sets.
# Unified render-region approach (handles both embedded-raster charts and prepp
# vector charts/tables): locate the set's directions text in the PDF, crop the
# region between the directions and the first question/option marker below it,
# redact placed logos + watermark text, render to a pixmap, gently whiten the
# faint baked watermark, autotrim. Writes PNGs + a results manifest.
#   python scripts/ingest/sbi/ibps_figs_extract.py
import fitz, json, os, re, io, hashlib
import numpy as np
from PIL import Image

SCRATCH = os.environ.get("SCRATCH",
    r"C:/Users/jijo1/AppData/Local/Temp/claude/C--Users-jijo1-OneDrive-Desktop-Lastmileprep/e444d752-aabc-46fe-af74-5a2e83e5dc78/scratchpad")
SRC = r"C:/Users/jijo1/OneDrive/Desktop/Lastmileprep latest/IBPS clerk"
OUT = os.path.join(SCRATCH, "ibps_ingest_figs"); os.makedirs(OUT, exist_ok=True)
sets = json.load(open(os.path.join(SCRATCH, "ibps_figs_manifest.json"), encoding="utf-8"))

WM_TEXT = re.compile(r"testbook|prepp|adda\s*247|your personal exam guide|www\.", re.I)
# markers that begin the questions/options AFTER the figure
MARK = re.compile(r"^(Q\.?\s*\d+\.|Que\.?\s*\d+|\(?a\)|\(?1\)|1\.|I\.)$", re.I)

def logo_xrefs(doc):
    cnt = {}
    for pg in doc:
        for xref in {im[0] for im in pg.get_images(full=True)}:
            cnt[xref] = cnt.get(xref, 0) + 1
    return {x for x, n in cnt.items() if n >= 3}  # a watermark repeats across pages

def gentle_clean(im):
    a = np.asarray(im.convert("RGB")).astype(np.int16)
    mx = a.max(2); mn = a.min(2); val = mx
    sat = np.where(mx > 0, (mx - mn) * 255 // np.maximum(mx, 1), 0)
    wm = (val > 205) & (sat < 45)  # faint gray watermark only
    a[wm] = [255, 255, 255]
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))

def autotrim(im, pad=14, thr=246):
    a = np.asarray(im.convert("L")); m = a < thr
    ys, xs = np.where(m)
    if not len(ys): return im
    h, w = a.shape
    return im.crop((max(0, xs.min()-pad), max(0, ys.min()-pad), min(w, xs.max()+pad), min(h, ys.max()+pad)))

def find_pdf(src):
    p = os.path.join(SRC, src)
    return p if os.path.exists(p) else None

def locate(doc, snip, directions):
    """Return (page_no, rect) of the directions text, trying the snippet then a
    short token from the directions."""
    for probe in (snip, " ".join(re.sub(r"[^A-Za-z0-9 ]", " ", directions).split()[:4])):
        probe = (probe or "").strip()
        if len(probe) < 6: continue
        for pn in range(doc.page_count):
            rc = doc[pn].search_for(probe)
            if rc: return pn, rc[0]
    return None, None

def figure_region(doc, pn, logos):
    """The figure = the biggest non-logo visual near the directions: prefer a
    large embedded raster (chart image), else the bounding box of the vector
    drawing cluster (prepp vector charts/tables). Search the directions page,
    then the next and previous page. Returns (page_no, Rect, kind) or (None…)."""
    for cand in (pn, pn + 1, pn - 1):
        if cand < 0 or cand >= doc.page_count: continue
        pg = doc[cand]
        # 1) biggest non-logo raster
        best = None
        for im in pg.get_images(full=True):
            if im[0] in logos: continue
            for rect in pg.get_image_rects(im[0]):
                if rect.width > 120 and rect.height > 80:
                    area = rect.width * rect.height
                    if not best or area > best[0]: best = (area, rect)
        if best:
            return cand, best[1], "raster"
        # 2) vector drawing-cluster bbox (exclude full-page frames)
        xs0 = ys0 = xs1 = ys1 = None
        for d in pg.get_drawings():
            rr = d["rect"]
            if rr.width > 25 and rr.height > 6 and rr.height < pg.rect.height * 0.85 and rr.width < pg.rect.width * 0.98:
                xs0 = rr.x0 if xs0 is None else min(xs0, rr.x0); ys0 = rr.y0 if ys0 is None else min(ys0, rr.y0)
                xs1 = rr.x1 if xs1 is None else max(xs1, rr.x1); ys1 = rr.y1 if ys1 is None else max(ys1, rr.y1)
        if xs0 is not None and (xs1 - xs0) > 120 and (ys1 - ys0) > 60:
            return cand, fitz.Rect(xs0, ys0, xs1, ys1), "vector"
    return None, None, None

results = []
for s in sets:
    src = s["src"]; lead = s["lead"]
    pdf = find_pdf(src)
    rec = {"src": src, "lead": lead, "members": s["members"]}
    if not pdf:
        rec["error"] = "pdf-not-found"; results.append(rec); continue
    doc = fitz.open(pdf)
    logos = logo_xrefs(doc)
    pn, r = locate(doc, s["locate"], s["directions"])
    if pn is None:
        rec["error"] = "directions-not-located"; results.append(rec); doc.close(); continue
    fpn, frect, kind = figure_region(doc, pn, logos)
    if fpn is None:
        rec["error"] = "figure-region-not-found"; results.append(rec); doc.close(); continue
    page = doc[fpn]
    # pad the figure box a touch so axis labels/legend aren't clipped
    clip = fitz.Rect(max(0, frect.x0 - 10), max(0, frect.y0 - 10),
                     min(page.rect.width, frect.x1 + 10), min(page.rect.height, frect.y1 + 10))

    # redact watermark text inside the clip before rendering (logos are excluded
    # from the region already; a baked faint watermark is handled by gentle_clean)
    for w in page.get_text("words"):
        if WM_TEXT.search(w[4]) and fitz.Rect(w[:4]).intersects(clip):
            page.add_redact_annot(fitz.Rect(w[:4]))
    try:
        page.apply_redactions(images=fitz.PDF_REDACT_IMAGE_NONE,
                              text=fitz.PDF_REDACT_TEXT_REMOVE,
                              graphics=fitz.PDF_REDACT_LINE_ART_NONE)
    except Exception:
        pass

    pix = page.get_pixmap(matrix=fitz.Matrix(3, 3), clip=clip)
    img = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
    img = gentle_clean(img)
    img = autotrim(img)
    if img.width < 950 and img.width > 0:
        sc = 1000 / img.width
        img = img.resize((int(img.width * sc), int(img.height * sc)), Image.LANCZOS)
    # unique filename per set (source hash avoids collisions between the 2025
    # shifts whose first 40 chars are identical)
    h = hashlib.md5(src.encode()).hexdigest()[:8]
    fn = re.sub(r"[^A-Za-z0-9_.-]", "_", f"{os.path.splitext(src)[0][:30]}_{h}__q{lead}_fig.png")
    img.save(os.path.join(OUT, fn))
    rec.update({"img": fn, "w": img.width, "h": img.height, "page": fpn, "kind": kind})
    results.append(rec)
    doc.close()

json.dump(results, open(os.path.join(SCRATCH, "ibps_figs_results.json"), "w", encoding="utf-8"), indent=1)
ok = [r for r in results if r.get("img")]
print(f"extracted {len(ok)}/{len(results)} figures -> {OUT}")
for r in results:
    print(f"  {'OK ' if r.get('img') else 'ERR'} {r['src'][:34].ljust(34)} q{r['lead']}  "
          + (f"{r['w']}x{r['h']} p{r['page']} {r.get('kind','')}" if r.get('img') else r.get('error','?')))
