# DOCX Ingestion Pipeline (Dataset v2.0)

The single source of truth for the SSC CGL question bank is the set of manually
extracted **DOCX** files. This pipeline reads those documents, extracts
structured questions + images, and loads them into the canonical Supabase
schema. The previous PDF-era pipeline and dataset are retired.

## One-command usage

```bash
# Parse a single paper (or a whole folder) → data/ingested/<paperId>/
npm run ingest -- "<path-to.docx>"
npm run ingest -- "<folder-of-docx>"

# Validate the DB transform offline (no credentials needed)
npm run ingest:load -- data/ingested/<paperId> --dry-run

# Push to Supabase (needs NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)
npm run ingest:load -- data/ingested/<paperId>
```

Each ingested paper produces, under `data/ingested/<paperId>/`:

| File | Contents |
| --- | --- |
| `paper.json` | Canonical `ParsedPaper` (questions + assets metadata) |
| `stats.json` | Parse statistics |
| `assets/*` | Extracted images (only those referenced by content) |
| `load-plan.json` | (dry-run) the exact rows/URLs that would be written |

## Architecture

```
DOCX → docx-reader → format-detector → parser → ParsedPaper → loader → Supabase
```

| Module | Responsibility |
| --- | --- |
| `model.ts` | Canonical types (`ParsedPaper`, `ParsedQuestion`, `ContentBlock`). The contract every parser produces and the loader consumes. |
| `docx-reader.ts` | Unzips the DOCX and walks `word/document.xml` in document order into a flat paragraph stream (including paragraphs nested in layout tables), resolving image relationships to media bytes. |
| `sections.ts` | Normalises inconsistent section names to canonical `ExamSection`s. |
| `format-detector.ts` | Detects the source layout and derives paper metadata (exam, tier, year, date, shift, language) from the filename + header. |
| `parsers/tcs-parser.ts` | Parses TCS official response-sheet exports (Tier-1 and Tier-2 layouts). |
| `assets.ts` | Deduplicates referenced images into `RawAsset`s. |
| `ingest.ts` | CLI: read → detect → parse → write JSON + images. |
| `loader.ts` | Uploads images to Storage, rewrites image blocks with URLs, upserts `papers`/`questions`/`question_assets`, records an `ingestion_runs` row. |

## Answer-source policy (trustworthiness)

TCS response sheets record the candidate's **`Chosen Option`**, not an official
key. By product decision, a valid chosen option is treated as the correct
answer (`answer_source = 'chosen_option'`). Questions with **no** chosen option
(`Not Answered`) are **never** given a fabricated answer: `correct_option` stays
null, `needs_answer_key = true`, and they must be excluded from scored exams
until a real key is supplied. Feeding official SSC answer keys later upgrades
these to `answer_source = 'official_key'`.

## Content fidelity

Stems and options are stored as ordered `ContentBlock[]` (text / image / table),
so figures, math images and prose keep their original order. Text options are
stored text-only; response-sheet chrome (radio/number glyph images) is
discarded. Genuinely image-based options keep their images, uploaded to Storage
and referenced by URL.

## Supported formats & status

| Source | Parser | Status |
| --- | --- | --- |
| TCS response sheet — Tier-1 (2023) | `tcs-parser` | ✅ Verified (golden paper: 100 Q, exact 25/25/25/25 sections) |
| TCS response sheet — Tier-2 (Jan Paper-I) | `tcs-parser` | ✅ Parses & keys; section mapping for the "Module" layout is a follow-up |
| Image-dominant TCS scans (24 MB Shift-3/4) | — | ⚠️ Needs OCR (text layer nearly absent) |
| Publisher "Solved Paper" books | — | ⏳ Follow-up parser (OCR-garbled scans with answers + solutions) |

## Adding a new paper

1. Drop the DOCX in the dataset folder.
2. `npm run ingest -- "<file>"`
3. Review `stats.json` warnings; anything flagged (`unkeyed`, `option-count`)
   goes to manual review — it is surfaced, never hidden.
4. `npm run ingest:load -- data/ingested/<paperId>`
