// Recover the 50 gated 2022 SSC cloze questions: attach the passage (sourced from the
// original TCS response-sheet PDFs, hand-cleaned) to each blank question's stem, then
// un-gate (remove from excluded_questions). Backup first. Dry-run unless --apply.
import fs from "node:fs";
import pg from "pg";
const APPLY = process.argv.includes("--apply");
const SC = "C:/Users/jijo1/AppData/Local/Temp/claude/C--Users-jijo1-OneDrive-Desktop-Lastmileprep/e444d752-aabc-46fe-af74-5a2e83e5dc78/scratchpad";
const url = fs.readFileSync(".env.local", "utf8").match(/DATABASE_URL="?([^"\n\r]+)/)[1].trim();
const passages = JSON.parse(fs.readFileSync(SC + "/cloze_passages_clean.json", "utf8"));
const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await c.connect();
const backup = [];
let updated = 0, ungated = 0;
for (const [pid, passage] of Object.entries(passages)) {
  const qs = (await c.query(
    `select q.id, q.question_number qn, q.stem, q.stem_text
     from excluded_questions e join ssc_cgl.questions q on q.id=e.question_id
     where e.reason='cloze_missing_passage' and q.paper_id=$1 order by q.question_number`, [pid]
  )).rows;
  for (const q of qs) {
    const existing = Array.isArray(q.stem) ? q.stem : [];
    if (/some words have been deleted/i.test(q.stem_text || "")) continue; // already has passage
    const newStem = [{ kind: "text", text: passage }, ...existing.filter((b) => b && (b.text || b.kind === "image"))];
    const newStemText = passage + "\n\n" + q.stem_text;
    backup.push({ id: q.id, paper_id: pid, question_number: q.qn, stem: q.stem, stem_text: q.stem_text });
    if (APPLY) {
      await c.query(`update ssc_cgl.questions set stem=$1::jsonb, stem_text=$2, updated_at=now() where id=$3`,
        [JSON.stringify(newStem), newStemText, q.id]);
      await c.query(`delete from excluded_questions where question_id=$1`, [q.id]);
    }
    updated++; ungated++;
  }
}
fs.writeFileSync(SC + "/cloze_2022_backup.json", JSON.stringify(backup, null, 1));
console.log(`[${APPLY ? "APPLY" : "DRY-RUN"}] passages=${Object.keys(passages).length} questions=${updated} ungated=${ungated} backup=${backup.length}`);
if (APPLY) {
  await c.query(`notify pgrst, 'reload schema'`).catch(() => {});
  const cvq = (await c.query(`select count(*) n from cbt_valid_questions`)).rows[0].n;
  const stillGated = (await c.query(`select count(*) n from excluded_questions where reason='cloze_missing_passage'`)).rows[0].n;
  console.log(`cbt_valid_questions=${cvq}  still-gated-cloze=${stillGated}`);
}
await c.end();
