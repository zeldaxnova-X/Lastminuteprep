// Remediate SSC cloze contamination: the shared "Comprehension:" passage bled into
// option D of cloze/adjacent questions, leaving option D garbled AND cloze blanks
// unanswerable (passage missing from the stem). Per paper (1 passage each):
//   - contaminated option D  -> recover the real word (text before " Comprehension:")
//   - cloze "blank number N" -> prepend the passage to the stem (contaminated + orphans)
//   - non-cloze contaminated -> only clean the option (passage does not belong)
// Backs up every affected row first. Dry-run unless --apply.
import fs from "node:fs";
import pg from "pg";
const url = fs.readFileSync(".env.local", "utf8").match(/DATABASE_URL="?([^"\n\r]+)/)[1].trim();
const APPLY = process.argv.includes("--apply");
const SCRATCH = "C:/Users/jijo1/AppData/Local/Temp/claude/C--Users-jijo1-OneDrive-Desktop-Lastmileprep/e444d752-aabc-46fe-af74-5a2e83e5dc78/scratchpad";
const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await c.connect();
const s = "ssc_cgl";
const CLOZE = /blank\s*number\s*\d/i;
const CONTAM = /comprehension\s*:/i;

// extract the clean passage from a contaminated option text
function extractPassage(optText) {
  // drop everything up to and including "Comprehension:"; drop trailing "SubQuestion No : N"
  let p = optText.replace(/^[\s\S]*?comprehension\s*:\s*/i, "");
  p = p.replace(/\s*subquestion\s*no\s*:.*$/i, "").trim();
  return p;
}
function realWord(optText) {
  return optText.split(/\s*comprehension\s*:/i)[0].trim();
}

// papers that have any contamination or any orphan cloze
const papers = (await c.query(
  `select distinct paper_id from ${s}.questions
   where options::text ~* 'comprehension\\s*:'
      or (${"stem_text ~* 'blank\\s*number\\s*\\d'"} and stem_text !~* 'passage|deleted|comprehension' and options::text !~* 'comprehension\\s*:')`
)).rows.map(r => r.paper_id);

const backup = [];
const plan = { cleanOpt: 0, addPassage: 0, cleanOnly: 0, papers: 0, unrecoverable: [] };
const updates = []; // {id, newStem, newStemText, newOptions}

for (const pid of papers) {
  const qs = (await c.query(
    `select id, question_number qn, stem, stem_text, options, correct_option from ${s}.questions where paper_id=$1 order by question_number`, [pid]
  )).rows;
  // the paper's passage (from any contaminated option)
  let passage = null;
  for (const q of qs) {
    const cd = (q.options || []).find(o => CONTAM.test(o.text || ""));
    if (cd) { passage = extractPassage(cd.text); break; }
  }
  const clozeInPaper = qs.filter(q => CLOZE.test(q.stem_text || ""));
  if (!passage && clozeInPaper.some(q => !/passage|deleted|comprehension/i.test(q.stem_text))) {
    plan.unrecoverable.push(pid); // orphan cloze but no passage to recover
  }
  plan.papers++;
  for (const q of qs) {
    let opts = q.options || [];
    let stem = q.stem, stemText = q.stem_text;
    let changed = false;
    // 1) clean contaminated option
    const hasContam = opts.some(o => CONTAM.test(o.text || ""));
    if (hasContam) {
      opts = opts.map(o => {
        if (!CONTAM.test(o.text || "")) return o;
        const w = realWord(o.text);
        return { ...o, text: w, blocks: [{ kind: "text", text: w }], isImage: false };
      });
      changed = true;
      plan.cleanOpt++;
    }
    // 2) attach passage to cloze blank questions lacking it
    const isCloze = CLOZE.test(stemText || "");
    const alreadyHasPassage = /some words have been deleted|in the following passage/i.test(stemText || "");
    if (isCloze && passage && !alreadyHasPassage) {
      const blocks = Array.isArray(stem) ? stem : [];
      stem = [{ kind: "text", text: passage }, ...blocks.filter(b => b && (b.text || b.kind === "image"))];
      if (!blocks.length) stem = [{ kind: "text", text: passage }, { kind: "text", text: stemText }];
      stemText = passage + "\n\n" + stemText;
      changed = true;
      plan.addPassage++;
    } else if (hasContam && !isCloze) {
      plan.cleanOnly++;
    }
    if (changed) {
      backup.push({ id: q.id, paper_id: pid, question_number: q.qn, stem: q.stem, stem_text: q.stem_text, options: q.options });
      updates.push({ id: q.id, stem: JSON.stringify(stem), stem_text: stemText, options: JSON.stringify(opts) });
    }
  }
}

fs.writeFileSync(SCRATCH + "/ssc_cloze_backup.json", JSON.stringify(backup, null, 1));
console.log(`PLAN [${APPLY ? "APPLY" : "DRY-RUN"}]  papers=${plan.papers}  cleanOptD=${plan.cleanOpt}  addPassage=${plan.addPassage}  cleanOnly(non-cloze)=${plan.cleanOnly}  updates=${updates.length}`);
console.log("unrecoverable papers (orphan cloze, no passage):", plan.unrecoverable.length, plan.unrecoverable.slice(0, 5).join(", "));
console.log("backup rows:", backup.length);

// sample before/after
const sample = backup.slice(0, 2);
for (const b of sample) {
  const u = updates.find(x => x.id === b.id);
  console.log(`\n-- ${b.paper_id} Q${b.question_number} --`);
  console.log("  BEFORE optD:", (b.options.find(o=>/comprehension/i.test(o.text||""))||{}).text?.slice(0,80));
  console.log("  AFTER  stem_text:", u.stem_text.slice(0, 110).replace(/\n/g, " "));
  console.log("  AFTER  options:", JSON.parse(u.options).map(o=>o.key+"="+o.text.slice(0,20)).join(" | "));
}

if (APPLY) {
  let done = 0;
  for (const u of updates) {
    await c.query(`update ${s}.questions set stem=$1::jsonb, stem_text=$2, options=$3::jsonb, updated_at=now() where id=$4`, [u.stem, u.stem_text, u.options, u.id]);
    done++;
  }
  console.log(`\nAPPLIED ${done} updates.`);
}
await c.end();
