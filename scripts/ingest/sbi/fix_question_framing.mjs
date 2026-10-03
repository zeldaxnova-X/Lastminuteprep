/**
 * Per-question framing + directions repair (all sections, all exams schema-param).
 * Operates ONLY on questions that do NOT already have a {kind:context} block, so
 * it is safe to run after fix_english_sets.mjs and is re-runnable.
 *
 *  E. Dashes: strip runs of 3+ dash characters (a parsing artifact) from stems.
 *  C. Framing: when a stem begins with a directions preamble, split it into
 *     [ {kind:context}, {kind:text, the question} ] so the instruction reads
 *     apart from the actual question/data.
 *  B. Missing directions: when a recognisable question type carries NO directions
 *     (error-spotting with bare A–E options, sentence-improvement, fill-in-the-
 *     blank, simplification/number-series), prepend a standard {kind:context}
 *     directions block so the bare options/expression make sense.
 *
 * Reversible: writes a full backup. Dry-run unless --apply.
 *   node scripts/ingest/sbi/fix_question_framing.mjs --schema ibps_clerk [--apply]
 */
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const schema = args[args.indexOf("--schema") + 1] || "ibps_clerk";
if (!/^[a-z_]+$/.test(schema)) throw new Error("bad schema");
const SCRATCH = process.env.SCRATCH ||
  "C:/Users/jijo1/AppData/Local/Temp/claude/C--Users-jijo1-OneDrive-Desktop-Lastmileprep/e444d752-aabc-46fe-af74-5a2e83e5dc78/scratchpad";
const env = fs.readFileSync(".env.local", "utf8");
const DBURL = env.match(/DATABASE_URL="?([^"\n\r]+)/)[1].trim();

const collapse = (s) => (s || "").replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, " ").trim();
const sentences = (s) => collapse(s).split(/(?<=[.?!:])\s+/).filter(Boolean);

// strip runs of 3+ dashes (– — -), optionally space-separated, that leak from PDFs
const DASHRUN = /(?:[\u2010-\u2015\u2212-]\s*){3,}/g; // hyphen, figure/en/em dashes, bar, minus
const stripDashes = (s) => (s || "").replace(DASHRUN, " ").replace(/[ \t]{2,}/g, " ").trim();

// a sentence that is instructional (directions), not content
const DIRSENT = /^(directions?\b|direction\b|in the following (sentence|question|passage|paragraph)|in this question|in the given (sentence|question)|read the (following|given|information|passage|sentence|question)|study the (following|given|information)|select the (correct|most appropriate|option|phrase|word)|choose the (correct|most appropriate|option|word|alternative)|identify the|find out|rearrange|arrange the|a sentence (is|has been)|the given (sentence|passage)|four words|(four|five) sentences|below (are|is)|below in each|these words|four options|a part of the sentence|what (value|number|will|should) (come|be)|a word (is|has been))/i;
const DIRVOCAB = /\b(as the answer|rearrangement is required|no rearrangement|mark (the )?option|click the button|no error.{0,14}(option|answer)|answer the (given )?questions?|find out which part|corresponding to it|different arrangements|has been provided|ignore (the )?errors? of punctuation|no improvement|improvement is needed|choose the alternative|free from error|not contributing to the main theme|odd sentence|coherent (paragraph|sentence)|place of (the )?question mark|print(ed)? in bold)\b/i;

function stemBlocks(blocks, fallback) {
  if (Array.isArray(blocks)) {
    const t = blocks.filter((b) => (b.kind === "text") && b.text).map((b) => b.text).join(" ");
    if (t) return t;
  }
  return fallback || "";
}
const optTexts = (options) => (Array.isArray(options) ? options.map((o) => collapse(o.text || "")) : []);

/** Generate standard directions for a type that shipped without any. */
function genDirections(stem, opts) {
  const lo = opts.map((o) => o.toLowerCase());
  const bareLetters = opts.length >= 4 && opts.filter((o) => /^[A-E]$/.test(o.trim())).length >= opts.length - 1;
  const hasNoError = lo.some((o) => /\bno error\b/.test(o));
  const segMarkers = /\(\s*[A-E]\s*\)\s*\/|\/\s*\(?[A-E]\)?|\(A\)[\s\S]*\(B\)[\s\S]*\(C\)[\s\S]*\(D\)/.test(stem);
  if ((bareLetters || hasNoError) && (segMarkers || hasNoError)) {
    return "In the sentence below, find the part that contains an error and choose its letter. If the sentence has no error, choose the 'No error' option.";
  }
  if (lo.some((o) => /\bno improvement\b/.test(o))) {
    return "A part of the sentence below may need improvement. Choose the option that best replaces it; if it needs no improvement, choose 'No improvement'.";
  }
  if (/question mark\s*\(\?\)|place of the question mark|=\s*\?\s*$|\?\s*=\s*$/.test(stem)) {
    return "Solve the expression and choose the value that should come in place of the question mark (?).";
  }
  return null;
}

function makeStem(context, ask, label) {
  const ctx = collapse(context), q = collapse(ask);
  if (ctx && q && ctx !== q) return { blocks: [{ kind: "context", label: label || "Directions", text: ctx }, { kind: "text", text: q }], flat: `${ctx}  ${q}` };
  const only = q || ctx;
  return { blocks: [{ kind: "text", text: only }], flat: only };
}

const c = new pg.Client({ connectionString: DBURL, ssl: { rejectUnauthorized: false } });
await c.connect();

if (args.includes("--restore")) {
  const rows = JSON.parse(fs.readFileSync(path.join(SCRATCH, `fix_framing_${schema}_backup.json`), "utf8"));
  for (const r of rows) await c.query(`update ${schema}.questions set stem=$1::jsonb, stem_text=$2, updated_at=now() where id=$3`, [JSON.stringify(r.stem), r.stem_text, r.id]);
  console.log(`restored ${rows.length} rows in ${schema}`);
  await c.end(); process.exit(0);
}

const all = (await c.query(`select id, section, stem, stem_text, options from ${schema}.questions order by paper_id, question_number`)).rows;
const backup = [];
let dashed = 0, framed = 0, gendir = 0;
const samples = [];

for (const q of all) {
  // skip questions already framed (have a context block) — leave fix_english_sets' work intact
  if (Array.isArray(q.stem) && q.stem.some((b) => b.kind === "context")) continue;

  const origText = stemBlocks(q.stem, q.stem_text);
  let text = stripDashes(origText);
  const dashChanged = text !== collapse(origText);
  const opts = optTexts(q.options);

  let newStem = null;
  const ss = sentences(text);

  // C. split a leading directions preamble
  if (ss.length >= 2 && DIRSENT.test(ss[0])) {
    let d = 0;
    while (d < ss.length - 1 && (DIRSENT.test(ss[d]) || DIRVOCAB.test(ss[d]))) d++;
    const dir = ss.slice(0, d).join(" ");
    const rest = ss.slice(d).join(" ");
    if (d >= 1 && collapse(dir).length >= 12 && collapse(rest).length >= 4) {
      newStem = makeStem(dir, rest, /passage/i.test(dir) ? "Passage" : "Directions");
      framed++;
    }
  }

  // B. generate directions when none present and the type is recognisable
  if (!newStem) {
    const dir = genDirections(text, opts);
    if (dir) { newStem = makeStem(dir, text, "Directions"); gendir++; }
  }

  // E. dash-only change (no framing): rewrite the single text block
  if (!newStem && dashChanged) {
    newStem = { blocks: [{ kind: "text", text }], flat: text };
  }

  if (!newStem) continue;
  if (dashChanged) dashed++;
  backup.push({ id: q.id, stem: q.stem, stem_text: q.stem_text });
  if (samples.length < 25) samples.push({ sec: q.section, kind: newStem.blocks[0].kind === "context" ? (newStem.blocks[0].label) : "dash", ctx: (newStem.blocks[0].text || "").slice(0, 55), ask: (newStem.blocks.find((b) => b.kind === "text")?.text || "").slice(0, 50) });
  if (APPLY) {
    await c.query(`update ${schema}.questions set stem=$1::jsonb, stem_text=$2, updated_at=now() where id=$3`, [JSON.stringify(newStem.blocks), newStem.flat, q.id]);
  }
}

fs.writeFileSync(path.join(SCRATCH, `fix_framing_${schema}_backup.json`), JSON.stringify(backup, null, 1));
console.log(`\n[${APPLY ? "APPLY" : "DRY-RUN"}] ${schema}: framed=${framed} genDirections=${gendir} dashStripped=${dashed} total=${backup.length}`);
for (const s of samples) console.log(`  [${s.sec.slice(0, 4)}|${s.kind}] ctx="${s.ctx}" | ask="${s.ask}"`);
await c.end();
