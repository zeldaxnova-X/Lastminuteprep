/**
 * Build the IBPS DI-figure manifest: group gated questions into DI sets and
 * emit, per set, the source PDF, lead question, the full member list
 * (lead..lead+4, existing only), a distinctive locate snippet from the lead's
 * directions, and each member's directions/sub-question split. The Python
 * extractor (ibps_figs_extract.py) consumes this; the ingester attaches the
 * cropped figure to every member and un-gates the set.
 *   node scripts/ingest/sbi/ibps_figs_manifest.mjs
 */
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const SCRATCH = process.env.SCRATCH ||
  "C:/Users/jijo1/AppData/Local/Temp/claude/C--Users-jijo1-OneDrive-Desktop-Lastmileprep/e444d752-aabc-46fe-af74-5a2e83e5dc78/scratchpad";

function dbUrl() {
  const env = fs.readFileSync(path.resolve(".env.local"), "utf8");
  return env.match(/DATABASE_URL="?([^"\n\r]+)/)[1].trim();
}

const c = new pg.Client({ connectionString: dbUrl(), ssl: { rejectUnauthorized: false } });
await c.connect();

// All gated questions, with their stem, ordered.
const gated = (await c.query(
  `select e.question_id id, q.source_document src, q.question_number qn
   from ibps_clerk.excluded_questions e
   join ibps_clerk.questions q on q.id = e.question_id
   order by q.source_document, q.question_number`
)).rows;

// Group into contiguous runs per source -> each run's start is a DI-set lead.
const leads = [];
let prev = null;
for (const r of gated) {
  if (!prev || prev.src !== r.src || r.qn !== prev.qn + 1) leads.push({ src: r.src, lead: r.qn });
  prev = r;
}

const sets = [];
for (const { src, lead } of leads) {
  // Members = existing questions in [lead, lead+4] for this paper+numerical section.
  const members = (await c.query(
    `select id, question_number qn, stem_text, stem
     from ibps_clerk.questions
     where source_document = $1 and section = 'numerical_ability'
       and question_number between $2 and $3
     order by question_number`,
    [src, lead, lead + 4]
  )).rows;
  const leadRow = members.find((m) => m.qn === lead) || members[0];
  const dir = (leadRow.stem_text || "").replace(/\s+/g, " ").trim();
  // A distinctive ~40-char snippet from the directions (skip the generic opener).
  const snip = dir.replace(/^(Directions?|Direction)\s*:?\s*/i, "").slice(0, 60);
  sets.push({
    src,
    lead,
    members: members.map((m) => ({ id: m.id, qn: m.qn })),
    directions: dir,
    locate: snip,
  });
}

fs.mkdirSync(SCRATCH, { recursive: true });
const out = path.join(SCRATCH, "ibps_figs_manifest.json");
fs.writeFileSync(out, JSON.stringify(sets, null, 1));
console.log(`Wrote ${sets.length} DI sets -> ${out}`);
for (const s of sets) console.log(`  ${s.src.slice(0, 30).padEnd(30)} lead ${String(s.lead).padStart(2)}  members ${s.members.map((m) => m.qn).join(",")}`);
await c.end();
