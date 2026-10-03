/**
 * Attach the shared puzzle/caselet setup to orphaned reasoning & numerical
 * follow-ups ("Who sits right of Rita?", "How many live above G?") that were
 * ingested without it. Interleaved puzzles make "nearest long question" unsafe,
 * so a carrier is accepted ONLY when it contains the follow-up's own entities
 * (the single-letter people A–Z and the proper names it names). A follow-up with
 * no entity-matching carrier is left untouched and reported (→ gate separately).
 *
 * Only touches questions WITHOUT an existing {kind:context} block. Reversible via
 * a full backup. Dry-run unless --apply.
 *   node scripts/ingest/sbi/fix_reasoning_context.mjs --schema ibps_clerk [--apply]
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

const collapse = (s) => (s || "").replace(/\s+/g, " ").trim();
const sentences = (s) => collapse(s).split(/(?<=[.?!])\s+/).filter(Boolean);
const STOP = new Set([
  "I", "A", "The", "In", "If", "Who", "How", "What", "Which", "When", "No", "Mr", "Ms", "As", "At", "On", "Of", "To",
  // common puzzle nouns that are capitalised but are NOT entities
  "Floor", "Floors", "Flat", "Flats", "Combination", "Correct", "Incorrect", "Statement", "Statements", "True", "False",
  "Car", "Cars", "Box", "Boxes", "Day", "Days", "Month", "Months", "Year", "Years", "Person", "Persons", "People",
  "North", "South", "East", "West", "Row", "Rows", "Table", "Building", "Buildings", "City", "Cities", "Movie", "Position",
  "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
  "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December",
]);

/** Puzzle entities in a stem: single capital letters used as people (A–Z, not the
 *  option labels) and capitalised proper names. */
function entities(text) {
  const e = new Set();
  for (const m of text.matchAll(/\b([A-Z])\b/g)) e.add(m[1]);               // people letters
  for (const m of text.matchAll(/\b([A-Z][a-z]{2,})\b/g)) if (!STOP.has(m[1])) e.add(m[1]); // names
  return e;
}
/** The follow-up's referenced entities (what it asks about). */
function askEntities(text) {
  const all = entities(text);
  return all; // small set; the carrier must cover these
}
function stemText(blocks, fallback) {
  if (Array.isArray(blocks)) {
    const t = blocks.filter((b) => b.kind === "text" && b.text).map((b) => b.text).join(" ");
    if (t) return t;
  }
  return fallback || "";
}
/** The setup = carrier content minus its own trailing question sentence(s). */
function setupOf(text) {
  const ss = sentences(text);
  let cut = ss.length;
  while (cut > 1 && (/\?\s*$/.test(ss[cut - 1]) || /^(who|how many|how is|which|what|find|name|whose|on which|at what)\b/i.test(ss[cut - 1]))) cut--;
  return cut >= 1 ? ss.slice(0, cut).join(" ") : text;
}

const ORPHAN = /\b(sits?\b|sitting|immediate (left|right|neighbou)|lives? on|which floor|the (top|bottom|ground|fifth|fourth|third|second|first|lowermost|topmost) floor|direction of .{1,20}with respect|code for\b|senior among|junior among|birthday (before|after|on)|work(s)? (on|at) .{1,18}position|pair .{0,20}(incorrect|correct)|which of the following (is true|statement is (true|correct|false|incorrect))|go(es)? for movie|most senior|above [A-Z]\b|below [A-Z]\b|between [A-Z] and [A-Z]|how many persons? (sit|live|are|have|study)|position of [A-Z]\b|rank of)\b/i;
const CARRIER_MIN = 300; // chars of content that likely hold a setup

const c = new pg.Client({ connectionString: DBURL, ssl: { rejectUnauthorized: false } });
await c.connect();

if (args.includes("--restore")) {
  const rows = JSON.parse(fs.readFileSync(path.join(SCRATCH, `fix_reasctx_${schema}_backup.json`), "utf8"));
  for (const r of rows) await c.query(`update ${schema}.questions set stem=$1::jsonb, stem_text=$2, updated_at=now() where id=$3`, [JSON.stringify(r.stem), r.stem_text, r.id]);
  console.log(`restored ${rows.length} rows in ${schema}`);
  await c.end(); process.exit(0);
}

const rows = (await c.query(
  `select id, paper_id, question_number qn, section, stem, stem_text from ${schema}.questions
   where section in ('reasoning','numerical_ability') order by paper_id, question_number`
)).rows.map((q) => ({ ...q, text: collapse(stemText(q.stem, q.stem_text)), full: collapse([...(Array.isArray(q.stem) ? q.stem : []).map((b) => b.text).filter(Boolean)].join(" ") || q.stem_text) }));

const byPaper = new Map();
for (const q of rows) { if (!byPaper.has(q.paper_id)) byPaper.set(q.paper_id, []); byPaper.get(q.paper_id).push(q); }

const backup = [];
let attached = 0, unresolved = 0;
const unresolvedList = [], sample = [];

for (const [, qs] of byPaper) {
  for (let i = 0; i < qs.length; i++) {
    const q = qs[i];
    if (Array.isArray(q.stem) && q.stem.some((b) => b.kind === "context")) continue; // already framed
    if (collapse(q.text).length >= 160 || !ORPHAN.test(q.text)) continue; // not an orphan follow-up
    const need = askEntities(q.text);
    if (need.size === 0) continue;
    // candidate carriers in the same paper+section, nearest first
    const cands = qs
      .filter((x) => x.section === q.section && x.qn !== q.qn && collapse(x.full).length >= CARRIER_MIN)
      .sort((a, b) => Math.abs(a.qn - q.qn) - Math.abs(b.qn - q.qn));
    let chosen = null;
    for (const cand of cands) {
      if (Math.abs(cand.qn - q.qn) > 8) break;
      const ce = entities(cand.full);
      const covered = [...need].filter((x) => ce.has(x)).length;
      // require the carrier to contain (nearly) all of the follow-up's entities
      if (covered >= need.size && covered >= 1) { chosen = cand; break; }
    }
    if (!chosen) { unresolved++; unresolvedList.push({ qn: q.qn, stem: q.text.slice(0, 60), need: [...need].join("") }); continue; }
    const setup = setupOf(chosen.full);
    if (collapse(setup).length < 120) { unresolved++; continue; }
    const label = /\bseries\b|\bnumbers?\b/i.test(setup) && q.section === "numerical_ability" ? "Information" : "Puzzle";
    const newStem = { blocks: [{ kind: "context", label, text: collapse(setup) }, { kind: "text", text: q.text }] };
    const flat = `${collapse(setup)}  ${q.text}`;
    backup.push({ id: q.id, stem: q.stem, stem_text: q.stem_text });
    if (sample.length < 20) sample.push({ qn: q.qn, carrier: chosen.qn, need: [...need].join(""), ask: q.text.slice(0, 48), setup: collapse(setup).slice(0, 55) });
    if (APPLY) await c.query(`update ${schema}.questions set stem=$1::jsonb, stem_text=$2, updated_at=now() where id=$3`, [JSON.stringify(newStem.blocks), flat, q.id]);
    attached++;
  }
}

fs.writeFileSync(path.join(SCRATCH, `fix_reasctx_${schema}_backup.json`), JSON.stringify(backup, null, 1));
fs.writeFileSync(path.join(SCRATCH, `fix_reasctx_${schema}_unresolved.json`), JSON.stringify(unresolvedList, null, 1));
console.log(`\n[${APPLY ? "APPLY" : "DRY-RUN"}] ${schema}: attached=${attached} unresolved=${unresolved}`);
for (const s of sample) console.log(`  q${s.qn}←carrier q${s.carrier} [${s.need}] ask="${s.ask}" setup="${s.setup}…"`);
if (unresolvedList.length) { console.log(`  --- unresolved (no entity-matching carrier) ---`); for (const u of unresolvedList.slice(0, 15)) console.log(`   q${u.qn} [${u.need}] ${u.stem}`); }
await c.end();
