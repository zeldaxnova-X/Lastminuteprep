# Produce clean, watermark-free figure images for the 14 SBI DI questions.
# Two cases, auto-detected per figure:
#  - CHART (embedded raster, e.g. line/bar graph): extract the chart image directly (this
#    drops the separately-placed Prepp/Adda logo overlay), then gently whiten the faint
#    baked watermark (light + low-saturation only) so the coloured plot + labels survive.
#  - TABLE (vector): remove the placed logo images, redact watermark text, and crop to the
#    table's own drawing bounding box.
# Logos are told apart from real chart rasters by repetition: a watermark image appears on
# many pages; a chart appears on one.
import fitz, json, os, re
import numpy as np
from PIL import Image

SCRATCH = r"C:/Users/jijo1/AppData/Local/Temp/claude/C--Users-jijo1-OneDrive-Desktop-Lastmileprep/e444d752-aabc-46fe-af74-5a2e83e5dc78/scratchpad"
SBI = r"C:/Users/jijo1/OneDrive/Desktop/Lastmileprep latest/SBI Clerk"
OUT = os.path.join(SCRATCH, "sbi_ingest_figs"); os.makedirs(OUT, exist_ok=True)
figs = json.load(open(os.path.join(SCRATCH, "sbi_final_figs.json"), encoding="utf-8"))["figures"]
WM_TEXT = re.compile(r"testbook|prepp|adda\s*247|your personal exam guide", re.I)

def logo_xrefs(doc):
    cnt = {}
    for pg in doc:
        for xref in {im[0] for im in pg.get_images(full=True)}:
            cnt[xref] = cnt.get(xref, 0) + 1
    return {x for x, n in cnt.items() if n >= 3}  # a watermark repeats across pages

def gentle_clean(im):
    a = np.asarray(im.convert("RGB")).astype(np.int16)
    mx = a.max(2); mn = a.min(2); val = mx; sat = np.where(mx > 0, (mx - mn) * 255 // np.maximum(mx, 1), 0)
    wm = (val > 205) & (sat < 45)  # faint gray watermark only
    a[wm] = [255, 255, 255]
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))

def autotrim(im, pad=16, thr=244):
    a = np.asarray(im.convert("L")); m = a < thr
    ys, xs = np.where(m)
    if not len(ys): return im
    h, w = a.shape
    return im.crop((max(0, xs.min()-pad), max(0, ys.min()-pad), min(w, xs.max()+pad), min(h, ys.max()+pad)))

def locate(doc, f):
    for snip in f["snippets"]:
        snip = (snip or "").strip()
        if len(snip) < 8: continue
        for pn in range(doc.page_count):
            rc = doc[pn].search_for(snip)
            if rc: return pn, rc[0]
    tok = " ".join(re.sub(r"[^A-Za-z0-9 ]", " ", f["setup"]).split()[:3])
    for pn in range(doc.page_count):
        rc = doc[pn].search_for(tok)
        if rc: return pn, rc[0]
    return None, None

results = []
for f in figs:
    doc = fitz.open(os.path.join(SBI, f["source"]))
    logos = logo_xrefs(doc)
    pn, r = locate(doc, f)
    page = doc[min(pn + 1, doc.page_count - 1)] if f.get("pagebreak") else doc[pn]
    y_top = 30 if f.get("pagebreak") else (r.y1 + 2)
    ques = [w[1] for w in page.get_text("words") if re.match(r"que", w[4], re.I) and w[1] > y_top + 15]
    y_bot = (min(ques) - 4) if ques else min(page.rect.height, y_top + 500)
    region = fitz.Rect(0, y_top, page.rect.width, y_bot)

    # a real chart raster in the region = a non-logo image intersecting it
    chart_img = None
    for im in page.get_images(full=True):
        if im[0] in logos: continue
        for rect in page.get_image_rects(im[0]):
            if rect.intersects(region) and rect.width > 60 and rect.height > 50:
                chart_img = im[0]; break
        if chart_img: break

    if chart_img is not None:  # CHART: extract embedded raster (drops logo overlay), gentle clean
        info = doc.extract_image(chart_img)
        img = Image.open(fitz_bytes := __import__("io").BytesIO(info["image"])).convert("RGB")
        img = gentle_clean(img)
        img = autotrim(img, pad=10, thr=248)
        if img.width < 950:
            sc = 1000 / img.width
            img = img.resize((int(img.width * sc), int(img.height * sc)), Image.LANCZOS)
        kind_note = "chart(raster-extract)"
    else:  # TABLE (vector): drop logos, redact wm text, crop to table drawing bbox
        for im in page.get_images(full=True):
            for rect in page.get_image_rects(im[0]):
                page.add_redact_annot(rect)
        page.apply_redactions(images=fitz.PDF_REDACT_IMAGE_REMOVE, text=fitz.PDF_REDACT_TEXT_NONE, graphics=fitz.PDF_REDACT_LINE_ART_NONE)
        hits = [fitz.Rect(w[:4]) for w in page.get_text("words") if WM_TEXT.search(w[4])]
        for rect in hits: page.add_redact_annot(rect)
        if hits: page.apply_redactions(images=fitz.PDF_REDACT_IMAGE_NONE, text=fitz.PDF_REDACT_TEXT_REMOVE, graphics=fitz.PDF_REDACT_LINE_ART_NONE)
        # table bbox = union of drawing rects inside the region
        xs0=xs1=ys0=ys1=None
        for d in page.get_drawings():
            rr = d["rect"]
            if rr.intersects(region) and rr.width > 30 and rr.height > 8:
                xs0 = rr.x0 if xs0 is None else min(xs0, rr.x0); ys0 = rr.y0 if ys0 is None else min(ys0, rr.y0)
                xs1 = rr.x1 if xs1 is None else max(xs1, rr.x1); ys1 = rr.y1 if ys1 is None else max(ys1, rr.y1)
        clip = fitz.Rect(max(0, xs0-8), max(y_top, ys0-14), min(page.rect.width, xs1+8), min(y_bot, ys1+8)) if xs0 is not None else region
        pix = page.get_pixmap(matrix=fitz.Matrix(3, 3), clip=clip)
        img = autotrim(Image.frombytes("RGB", (pix.width, pix.height), pix.samples), pad=12)
        kind_note = "table(vector-crop)"

    fn = f"{f['paper_id']}__q{f['lead_qn']}_fig.png"
    img.save(os.path.join(OUT, fn))
    results.append({**f, "img": fn, "w": img.width, "h": img.height, "note": kind_note})
    doc.close()

json.dump(results, open(os.path.join(SCRATCH, "sbi_ingest_figs.json"), "w", encoding="utf-8"), indent=1)
print("done", len(results))
for r in results: print(f"  {r['note']:22} Q{r['lead_qn']} {r['w']}x{r['h']}  {r['paper_id'][-14:]}")
