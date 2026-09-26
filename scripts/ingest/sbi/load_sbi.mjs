/**
 * Load parsed SBI JSON (from parse_sbi.py --emit) into the exam's OWN schema.
 * Parameterised by exam; writes ONLY into <schema>.papers/questions — never
 * another exam's namespace. Idempotent per paper (deterministic paper_id).
 *
 *   node scripts/ingest/sbi/load_sbi.mjs data/ingested_sbi/sbi-clerk-prelims [--dry-run]
 *
 * QC on load (defensive re-check; reject, never fix):
 *   - stem present, exactly N well-formed options, key letter in range
 *   - near-duplicate rejection by normalised hash, within the batch AND vs the
 *     existing bank for THIS exam
 * Writes an ingestion_runs audit row per paper.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import pg from "pg";

// --- exam registry (mirror of src/lib/exam/registry.ts, script-local) ---
const EXAMS = {
  "sbi-clerk-prelims": {
    schema: "sbi_clerk",
    examLabel: "SBI Clerk",
    optionsCount: 5,
    marksCorrect: 1,
    marksWrong: 0.25,
    datasetVersion: "sbi-2.0",
  },
};

function dbUrl() {
  const env = fs.readFileSync(path.resolve(".env.local"), "utf8");
  const m = env.match(/DATABASE_URL="?([^"\n\r]+)/);
  if (!m) throw new Error("DATABASE_URL not found in .env.local");
  return m[1];
}

function normHash(s) {
  const t = (s || "").toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
  return crypto.createHash("sha256").update(t).digest("hex");
}

/** Deterministic paper id from the source filename → idempotent re-runs. */
function paperIdFrom(file) {
  return "sbi_" + path.basename(file).replace(/\.json$/i, "").replace(/[^A-Za-z0-9]+/g, "_").slice(0, 80);
}

function metaFromName(name) {
  const year = (name.match(/20\d{2}/) || [])[0] || null;
  const shift = (name.match(/Shift[_\s-]*([12])/i) || [])[1] || null;
  return { year: year ? parseInt(year, 10) : null, shift: shift ? `Shift ${shift}` : null };
}

function optionBlocks(text, i) {
  const key = String.fromCharCode(65 + i);
  return { key, index: i + 1, text, isImage: false, blocks: [{ kind: "text", text }] };
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const dir = args.find((a) => !a.startsWith("--"));
  if (!dir) throw new Error("Usage: load_sbi.mjs <ingested-dir> [--dry-run]");

  const examCode = path.basename(dir);
  const exam = EXAMS[examCode];
  if (!exam) throw new Error(`unknown exam ${examCode}`);

  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => path.join(dir, f));
  const client = new pg.Client({ connectionString: dbUrl(), ssl: { rejectUnauthorized: false } });
  await client.connect();

  // Existing hashes for THIS exam (dedup vs bank).
  const existing = new Set();
  const ex = await client.query(`select stem_text, options from ${exam.schema}.questions`);
  for (const r of ex.rows) {
    const optText = (r.options || []).map((o) => o.text || "").join(" ");
    existing.add(normHash((r.stem_text || "") + " " + optText));
  }

  const seenBatch = new Set();
  let totalIn = 0, totalLoaded = 0, totalDup = 0, totalQc = 0;

  for (const file of files) {
    const rep = JSON.parse(fs.readFileSync(file, "utf8"));
    const questions = rep.questions || [];
    totalIn += questions.length;
    const paperId = paperIdFrom(file);
    const { year, shift } = metaFromName(rep.file || file);
    const rows = [];
    let dup = 0, qc = 0;

    for (const q of questions) {
      const opts = (q.options || []).map((o) => (o || "").trim());
      // defensive QC
      if (!q.stem_text || q.stem_text.length < 8) { qc++; continue; }
      if (opts.length !== exam.optionsCount || opts.some((o) => !o)) { qc++; continue; }
      if (new Set(opts).size !== opts.length) { qc++; continue; }
      const idx = q.correct_index;
      if (!(idx >= 1 && idx <= exam.optionsCount)) { qc++; continue; }
      if (!q.section) { qc++; continue; }
      const h = normHash((q.stem_text || "") + " " + opts.join(" "));
      if (existing.has(h) || seenBatch.has(h)) { dup++; continue; }
      seenBatch.add(h);
      rows.push({
        id: crypto.randomUUID(),
        paper_id: paperId,
        question_number: q.question_number,
        section: q.section,
        // Split an attached shared-context (context \n\n question) into separate
        // paragraphs so the directions and the question render distinctly.
        stem: JSON.stringify(
          String(q.stem_text).split(/\n\n+/).map((t) => ({ kind: "text", text: t.trim() })).filter((b) => b.text)
        ),
        stem_text: String(q.stem_text).replace(/\n\n+/g, "  "),
        options: JSON.stringify(opts.map((t, i) => optionBlocks(t, i))),
        has_images: false,
        correct_option: String.fromCharCode(64 + idx), // 1->A .. 5->E
        answer_source: "solved_paper", // key came with the source solved paper
        answer_status: "answered",
        needs_answer_key: false,
        marks: exam.marksCorrect,
        negative_marks: exam.marksWrong,
        source_document: rep.file || path.basename(file),
        dataset_version: exam.datasetVersion,
      });
    }
    totalDup += dup; totalQc += qc; totalLoaded += rows.length;
    console.log(`${rep.file}: in=${questions.length} load=${rows.length} dup=${dup} qcReject=${qc} [${year || "?"} ${shift || ""}]`);

    if (dryRun || rows.length === 0) continue;

    // Upsert paper (this exam's schema only). Set every NOT-NULL column
    // explicitly rather than relying on defaults copied from the SSC table.
    const sectionsOrder = JSON.stringify(rep.section_order || []);
    // Canonical name must be unique. Use year+shift when present; else fall back
    // to the (unique) source filename so hash-named papers don't collide.
    const label = `${exam.examLabel} Prelims ${year || ""} ${shift || ""}`.replace(/\s+/g, " ").trim();
    const canonical = year && shift ? label : `${exam.examLabel} Prelims — ${(rep.file || paperId).replace(/\.pdf$/i, "")}`;
    await client.query(
      `insert into ${exam.schema}.papers
         (paper_id, paper_name_original, paper_name_canonical, exam, year, shift, tier,
          paper_type, expected_questions, validated_questions, source_pdf, language,
          sections_order, total_questions, dataset_version, published)
       values ($1,$2,$3,$4,$5,$6,NULL,'memory_based',$7,$7,$8,'en',$9::jsonb,$7,$10,true)
       on conflict (paper_id) do update set
         total_questions=excluded.total_questions, validated_questions=excluded.validated_questions,
         sections_order=excluded.sections_order, updated_at=now(), published=true`,
      [paperId, rep.file, canonical, exam.examLabel, year, shift, rows.length, rep.file, sectionsOrder, exam.datasetVersion]
    );
    // Replace this paper's questions (idempotent re-run).
    await client.query(`delete from ${exam.schema}.questions where paper_id=$1`, [paperId]);
    for (const r of rows) {
      await client.query(
        `insert into ${exam.schema}.questions
         (id, paper_id, question_number, section, stem, stem_text, options, has_images, correct_option, answer_source, answer_status, needs_answer_key, marks, negative_marks, source_document, dataset_version)
         values ($1,$2,$3,$4,$5::jsonb,$6,$7::jsonb,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
        [r.id, r.paper_id, r.question_number, r.section, r.stem, r.stem_text, r.options, r.has_images, r.correct_option, r.answer_source, r.answer_status, r.needs_answer_key, r.marks, r.negative_marks, r.source_document, r.dataset_version]
      );
    }
    // Audit row (ingestion_runs is public; paper_id is a soft ref post-isolation).
    await client.query(
      `insert into ingestion_runs (paper_id, status, notes) values ($1,'loaded',$2)
       on conflict do nothing`,
      [paperId, `sbi load: ${rows.length} questions, ${dup} dup, ${qc} qc-reject`]
    ).catch(() => {});
  }

  console.log(`\n=== ${dryRun ? "DRY RUN" : "LOADED"}: in=${totalIn} loaded=${totalLoaded} dup=${totalDup} qcReject=${totalQc} into ${exam.schema} ===`);
  await client.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
