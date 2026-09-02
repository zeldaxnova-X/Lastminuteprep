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
