/**
 * Loads an ingested paper (produced by ingest.ts) into Supabase:
 *   1. uploads every referenced image to Storage,
 *   2. rewrites image content blocks with their public URL,
 *   3. upserts the paper + questions + question_assets rows,
 *   4. records an ingestion_runs audit row.
 *
 *   npm run ingest:load -- data/ingested/<paperId>            # live push
 *   npm run ingest:load -- data/ingested/<paperId> --dry-run  # validate only
 *
 * Live push needs SUPABASE_SERVICE_ROLE_KEY (+ NEXT_PUBLIC_SUPABASE_URL) in the
 * environment / .env.local. --dry-run builds and validates every payload
 * without a database connection, so the JSON→DB transform can be verified
 * offline.
 */
import { readFile, readdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import type { ContentBlock, ParsedPaper, ParsedQuestion } from "./model";

const BUCKET = "question-assets";
const DATASET_VERSION = "2.0";

interface LoadArgs {
  dir: string;
  dryRun: boolean;
}

function parseArgs(argv: string[]): LoadArgs {
  let dir = "";
  let dryRun = false;
  for (const a of argv) {
    if (a === "--dry-run") dryRun = true;
    else dir = a;
  }
  if (!dir) throw new Error('Usage: npm run ingest:load -- <ingested-dir> [--dry-run]');
  return { dir: resolve(dir), dryRun };
}

/** Minimal .env.local reader (no dependency) for local live pushes. */
async function loadEnvLocal(): Promise<void> {
  const p = resolve(".env.local");
  if (!existsSync(p)) return;
  const txt = await readFile(p, "utf8");
  for (const line of txt.split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

interface AssetRow {
  asset_key: string;
  role: "stem" | "option" | "solution";
  option_key: string | null;
  ext: string;
  sha256: string;
  byte_length: number;
  storage_path: string;
  localFile: string;
}

/** Collect every asset a question references, tagged with role/option. */
function collectQuestionAssets(q: ParsedQuestion, paper: ParsedPaper, dir: string): AssetRow[] {
  const byKey = new Map<string, AssetRow>();
  const meta = new Map(paper.assets.map((a) => [a.id, a]));
  const add = (assetId: string, role: AssetRow["role"], optionKey: string | null) => {
    if (byKey.has(assetId)) return;
    const a = meta.get(assetId);
    if (!a) return;
    byKey.set(assetId, {
      asset_key: assetId,
      role,
      option_key: optionKey,
      ext: a.ext,
      sha256: a.sha256,
      byte_length: a.byteLength,
      storage_path: `${paper.paperId}/${assetId}.${a.ext}`,
      localFile: join(dir, "assets", `${assetId}.${a.ext}`),
    });
  };
  for (const b of q.stemBlocks) if (b.assetId) add(b.assetId, "stem", null);
  for (const o of q.options)
    for (const b of o.blocks) if (b.assetId) add(b.assetId, "option", o.key);
  for (const b of q.solutionBlocks) if (b.assetId) add(b.assetId, "solution", null);
  return [...byKey.values()];
}

/** Rewrite image blocks to include a resolvable URL. */
function withUrls(blocks: ContentBlock[], urlByKey: Map<string, string>): ContentBlock[] {
  return blocks.map((b) =>
    b.kind === "image" && b.assetId
      ? { ...b, url: urlByKey.get(b.assetId) ?? null }
      : b
  );
}

function questionRow(q: ParsedQuestion, paper: ParsedPaper, urlByKey: Map<string, string>) {
  return {
    paper_id: paper.paperId,
    question_number: q.questionNumber,
    external_id: q.externalId,
    section: q.section,
    topic: q.topic,
    difficulty: q.difficulty,
    language: q.language,
    stem: withUrls(q.stemBlocks, urlByKey),
    stem_text: q.stemText,
    options: q.options.map((o) => ({
      key: o.key,
      index: o.index,
      text: o.text,
      isImage: o.isImage,
      blocks: withUrls(o.blocks, urlByKey),
    })),
    has_images: q.hasImages,
    correct_option: q.correctOption,
    answer_source: q.answerSource,
    answer_status: q.answerStatus,
    needs_answer_key: q.needsAnswerKey,
    solution: withUrls(q.solutionBlocks, urlByKey),
    solution_text: q.solutionText,
    marks: q.marks,
    negative_marks: q.negativeMarks,
    source_document: paper.sourceDocument,
    dataset_version: DATASET_VERSION,
    warnings: q.warnings,
  };
}

function contentType(ext: string): string {
  const map: Record<string, string> = {
    png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
    gif: "image/gif", webp: "image/webp", emf: "image/emf", wmf: "image/wmf",
  };
  return map[ext.toLowerCase()] ?? "application/octet-stream";
}

async function main() {
  const { dir, dryRun } = parseArgs(process.argv.slice(2));
  const paper: ParsedPaper = JSON.parse(await readFile(join(dir, "paper.json"), "utf8"));

  // Validate that every referenced asset file exists on disk.
  const assetFiles = new Set(
    existsSync(join(dir, "assets")) ? await readdir(join(dir, "assets")) : []
  );
  const missing: string[] = [];
  const allAssetRows = paper.questions.flatMap((q) => collectQuestionAssets(q, paper, dir));
  for (const a of allAssetRows) {
    const base = `${a.asset_key}.${a.ext}`;
    if (!assetFiles.has(base)) missing.push(base);
  }

  const paperRow = {
    paper_id: paper.paperId,
    paper_name_original: paper.sourceDocument,
    paper_name_canonical: paper.title || paper.paperId,
    exam: paper.exam,
    year: paper.year ?? 0,
    tier: paper.tier,
    paper_date: paper.examDate,
    exam_date: paper.examDate,
    shift: paper.shift,
    paper_type: paper.format,
    language: paper.language,
    source_pdf: paper.sourceDocument,
    source_document: paper.sourceDocument,
    sections_order: paper.sectionsOrder,
    expected_questions: paper.questions.length,
    validated_questions: paper.stats.withCorrectAnswer,
    total_questions: paper.questions.length,
    ingest_stats: paper.stats,
    dataset_version: DATASET_VERSION,
  };

  console.log(`\nLoad plan for ${paper.paperId}`);
  console.log(`  questions : ${paper.questions.length}`);
  console.log(`  assets    : ${allAssetRows.length} referenced (${paper.assets.length} extracted)`);
  console.log(`  missing   : ${missing.length}${missing.length ? " -> " + missing.slice(0, 5).join(", ") : ""}`);

  if (missing.length) throw new Error(`${missing.length} referenced asset file(s) missing on disk.`);

  if (dryRun) {
    // Build every row with placeholder URLs to prove the transform, then dump.
    const urlByKey = new Map(
      allAssetRows.map((a) => [a.asset_key, `https://<project>.supabase.co/storage/v1/object/public/${BUCKET}/${a.storage_path}`])
    );
    const questionRows = paper.questions.map((q) => questionRow(q, paper, urlByKey));
    const plan = { paperRow, questionCount: questionRows.length, assetCount: allAssetRows.length, sampleQuestion: questionRows[0], sampleAssets: allAssetRows.slice(0, 3) };
    await writeFile(join(dir, "load-plan.json"), JSON.stringify(plan, null, 2), "utf8");
    console.log(`  ✔ dry-run OK — transform validated, wrote ${join(dir, "load-plan.json")}`);
    return;
  }

  await loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Live load needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY " +
        "(add them to .env.local). Or run with --dry-run to validate offline."
    );
  }

  const { createClient } = await import("@supabase/supabase-js");
  const db = createClient(url, key, { auth: { persistSession: false } });

  // 1) Bucket (idempotent).
  await db.storage.createBucket(BUCKET, { public: true }).catch(() => {});

  // 2) Upload each distinct asset file once, capturing public URLs.
  const urlByKey = new Map<string, string>();
  const uploaded = new Set<string>();
  for (const a of allAssetRows) {
    if (!uploaded.has(a.storage_path)) {
      const bytes = await readFile(a.localFile);
      const up = await db.storage
        .from(BUCKET)
        .upload(a.storage_path, bytes, { contentType: contentType(a.ext), upsert: true });
      if (up.error) throw new Error(`Upload failed for ${a.storage_path}: ${up.error.message}`);
      uploaded.add(a.storage_path);
    }
    urlByKey.set(a.asset_key, db.storage.from(BUCKET).getPublicUrl(a.storage_path).data.publicUrl);
  }
  console.log(`  ↑ uploaded ${uploaded.size} distinct assets (${allAssetRows.length} references)`);

  // 3) Upsert paper.
  {
    const { error } = await db.from("papers").upsert(paperRow, { onConflict: "paper_id" });
    if (error) throw new Error(`papers upsert failed: ${error.message}`);
  }

  // 4) Replace questions for this paper, then insert fresh.
  await db.from("questions").delete().eq("paper_id", paper.paperId);
  const rows = paper.questions.map((q) => questionRow(q, paper, urlByKey));
  for (let i = 0; i < rows.length; i += 100) {
    const chunk = rows.slice(i, i + 100);
    const { data, error } = await db.from("questions").insert(chunk).select("id, question_number");
    if (error) throw new Error(`questions insert failed: ${error.message}`);
    // 5) question_assets for this chunk.
    const idByNum = new Map((data ?? []).map((r) => [r.question_number, r.id]));
    const assetRows = chunk.flatMap((_, j) => {
      const q = paper.questions[i + j];
      const qid = idByNum.get(q.questionNumber);
      if (!qid) return [];
      return collectQuestionAssets(q, paper, dir).map((a) => ({
        question_id: qid,
        paper_id: paper.paperId,
        asset_key: a.asset_key,
        role: a.role,
        option_key: a.option_key,
        storage_path: a.storage_path,
        public_url: urlByKey.get(a.asset_key),
        sha256: a.sha256,
        ext: a.ext,
        byte_length: a.byte_length,
      }));
    });
    if (assetRows.length) {
      const { error: aerr } = await db.from("question_assets").insert(assetRows);
      if (aerr) throw new Error(`question_assets insert failed: ${aerr.message}`);
    }
  }
  console.log(`  ✔ inserted ${rows.length} questions`);

  // 6) Audit + paper counts.
  const s = paper.stats;
  await db.from("ingestion_runs").insert({
    source_document: paper.sourceDocument,
    paper_id: paper.paperId,
    format: paper.format,
    dataset_version: DATASET_VERSION,
    total_questions: s.totalQuestions,
    with_answer: s.withCorrectAnswer,
    needs_answer_key: s.needsAnswerKey,
    image_questions: s.imageQuestions,
    total_assets: urlByKey.size,
    warnings: s.warnings,
    stats: s,
    status: "completed",
    completed_at: new Date().toISOString(),
  });

  console.log(`\n✅ Loaded ${paper.paperId} into Supabase.`);
}

main().catch((err) => {
  console.error(`\n✖ ${(err as Error).message}`);
  process.exit(1);
});
