# PYQ Ingestion Standard (image-based questions)

The quality bar and pipeline for turning scanned SSC CGL papers into clean,
commercial-grade questions. **Apply this to every PYQ paper we upload, going
forward.** It exists because the source PDFs are low-resolution scans and the
first ingestion left broken math, blurry figures, question text baked into
images, and mismatched options.

## The standard (per question)

Rebuild each question as a **complete unit**: stem **+ all four options + the
verified answer**. Never a partial fix.

| Content | Do this | Result |
|---|---|---|
| Math, word problems | Typed text with **LaTeX** (`$...$`, `$$...$$`) | crisp, searchable |
| Data tables | Real `{kind:"table", rows:[...]}` blocks | crisp |
| Geometry (triangle/circle/angles) | Recreate as clean **SVG** | crisp at any zoom |
| Graphs (pie/bar) | Recreate from the **data** as an SVG chart | crisp |
| Spatial (dice, nets) | Recreate as **SVG** | crisp |
| Letter/number combos, the correct mirror | Typed text (+ CSS/SVG transform) | crisp |
| Intricate reasoning line-art (embedded-figure, rotating series, dot-grids) | **Clean the scan** (see below) — do NOT trace by hand (would risk changing the pattern) | sharp black line-art |

**Rule: convert everything that can be text into text; keep an image only for a
genuine diagram.** Never keep the question sentence inside a figure image.

## Block model + renderer

Blocks live in `questions.stem` / `questions.options[].blocks` (jsonb). The
renderer is `src/components/cbt/question-content.tsx` and supports:
`text` (KaTeX inline/block), `math` (`latex`), `image` (`url`, zoomable),
`table` (`rows`). Figures are uploaded to Supabase bucket `question-assets` at
`{paper_id}/{paper_id}__q{N}_fig.svg|png` (or `__q{N}_opt{i}...`) and referenced
as `{kind:"image", url, assetId}`; add a `question_assets` row (role
`stem`/`option`, `option_key`).

## Figure cleanup (line-art scans) — makes blurry figures crisp

No potrace/OpenCV in this env; `scripts/ingest/figures/clean_lib.py` uses only
Pillow + numpy: **upscale (LANCZOS) -> binarize -> light anti-alias**, turning
soft gray scans into solid black line-art. Run it on every cropped figure
(stem and option) before upload.

```
python scripts/ingest/figures/clean_lib.py <fig1.png> <fig2.png> ...
```

## Figure extraction from source

- Source PDFs: `Lastmileprep latest/ssc cgl/English/` (per-shift TCS response
  sheets, text layer). DB `external_id` == source `Question ID`. Layout:
  `Q.N <stem> \n Ans \n 1.-4. options \n Question ID : <id>`.
- Segment the page by `Question ID`; the stem is the text between `Q.N` and
  `Ans`; options are the `1.`-`4.` block after `Ans`.
- Some questions are scanned as **one image with the sentence baked in**
  (and the text is NOT in the text layer). Extract **figure-only** by row-band
  analysis: find horizontal ink bands, cut at the largest vertical gap (text on
  top, figure below), keep the figure band. Author the stem text separately.

### Reasoning figures: RENDER THE REGION, do not extract the raster

Reasoning figures (boxed series, embedded-figure, X-boxes, fold diagrams) are
usually **part vector, part low-res raster**: the drawn boxes/lines are vector
(crisp), but the arrows/letters/glyphs and the baked stem sentence sit in a
~680px raster. **Extracting the raster image alone loses the vector boxes** (the
series looks like it lost its cell dividers — the "bifurcation") and upscales the
low-res raster blurry. Fix — render the whole page **region** at high DPI
(`get_pixmap(matrix=Matrix(9,9), clip=region)`), which rasterizes the vector
crisply:

1. Stem: render `[Q.N .. Ans]`, then `figonly` (largest horizontal-ink-gap; keep
   the lower band) to drop the baked sentence. Author the sentence as a separate
   `text` block — it is NOT in the text layer, so `get_text` returns only `Q.N`.
2. Remove the page's **vertical border lines** (thin, full-height ink columns at
   the far left/right edges) before the final whitespace trim.
3. **Never binarize a region render** — the vector lines are already crisp;
   `clean_lib.clean()` (upscale+threshold) is for genuinely low-res *raster*
   line-art only, and it turns crisp vector renders blocky.
4. Boxed options: the option marker (`1.`-`4.`) sits at the box's **mid-left**,
   so the box extends above it. Crop each option with a window centered on its
   marker — `[marker.y0 - 0.32*spacing, marker.y0 + 0.70*spacing]` (spacing =
   median marker gap) — not `[marker.y0, next_marker.y0]` (which cuts the box top
   and bleeds the next option in).
5. **Genuinely low-res raster figures stay soft** (embedded-figure outlines like
   an irregular polygon "X", mirror-letter strings). Do not trace them by hand
   (risks changing the shape that the answer depends on). Give the best crop and
   **flag them in the remaining-images list for external (Gemini/ChatGPT)
   enhancement**.

### Serving updated figures

Assets live at `question-assets/{paper}/{paper}__q{N}_fig.{ext}` (or
`__q{N}_opt{i}`). To replace one, **POST to the same storage_path with
`x-upsert:true`** — the DB block URL is unchanged and the CDN serves the new
bytes immediately (verify by comparing served `content-length` to the local
file). The Supabase secret key is the new `sb_secret_...` format: pass it in
**both** `apikey` and `Authorization: Bearer` headers or the Storage API rejects
it as "Invalid Compact JWS".

## Non-negotiable checks (these all regressed once)

1. **LaTeX**: author question JSON in a **file** (`\\` for a backslash) and
   `JSON.parse` it — never build LaTeX through bash heredoc + JS string escaping
   (it silently ate `\dfrac` -> `dfrac`). After writing, read back and re-render
   with KaTeX; there must be **zero** literal `dfrac`/`left`/`pi`/`circ`.
2. **Options**: the original ingestion **scrambled options on figure questions**
   (e.g. a mirror question got "None are possible"). Re-extract options from
   source for figure questions, and **verify every question's options against the
   source** (segment source by Question ID, parse `1.`-`4.`, compare).
3. **No text in figures**: crop figure-only; the sentence is a separate text block.
4. **Answer**: keep `correct_option`; confirm it against the source's green tick.

## Verify before done

- `tsc` / lint clean for any code; per-paper spot-check (render each rebuilt
  question with KaTeX + tables + figures) sent for review.
- `cbt_valid_questions` count for the paper == its question count (no question
  dropped from the mock pool).

See also the working notes in Claude memory: `image-question-overhaul.md`,
`live-db-reality.md` (missing-stem method + counts).
