// Attach the cleaned IBPS DI figures to their questions so the gated DI sets
// become answerable, then un-gate them.
//   - upload each cleaned PNG to storage (bucket question-assets)
//   - prepend an {kind:image} block to EVERY question in the DI set (lead + the
//     4 follow-ups), set has_images=true, record a question_assets row
//   - remove the set's questions from excluded_questions (un-gate)
// Backs up every affected question first. Dry-run unless --apply.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import pg from "pg";

const APPLY = process.argv.includes("--apply");
const SCRATCH = process.env.SCRATCH ||
  "C:/Users/jijo1/AppData/Local/Temp/claude/C--Users-jijo1-OneDrive-Desktop-Lastmileprep/e444d752-aabc-46fe-af74-5a2e83e5dc78/scratchpad";
const FIGDIR = path.join(SCRATCH, "ibps_ingest_figs");
const env = fs.readFileSync(".env.local", "utf8");
const DBURL = env.match(/DATABASE_URL="?([^"\n\r]+)/)[1].trim();
const SURL = env.match(/NEXT_PUBLIC_SUPABASE_URL="?([^"\n\r]+)/)[1].trim();
const SKEY = env.match(/SUPABASE_SERVICE_ROLE_KEY="?([^"\n\r]+)/)[1].trim();
const sets = JSON.parse(fs.readFileSync(path.join(SCRATCH, "ibps_figs_results.json"), "utf8"));

async function upload(storagePath, buf) {
  const res = await fetch(`${SURL}/storage/v1/object/question-assets/${storagePath}`, {
    method: "POST",
    headers: { apikey: SKEY, Authorization: "Bearer " + SKEY, "Content-Type": "image/png", "x-upsert": "true" },
    body: buf,
  });
  if (!res.ok) throw new Error("upload " + res.status + " " + (await res.text()).slice(0, 150));
}

const c = new pg.Client({ connectionString: DBURL, ssl: { rejectUnauthorized: false } });
await c.connect();
const backup = [];
let figs = 0, qUpdated = 0, ungated = 0, errors = 0;

for (const s of sets) {
  if (!s.img) { console.log(`  SKIP (no img) ${s.src.slice(0, 30)} q${s.lead}`); errors++; continue; }
  const buf = fs.readFileSync(path.join(FIGDIR, s.img));
  const sha = crypto.createHash("sha256").update(buf).digest("hex");
  // paper_id from the first member
  const first = (await c.query(`select paper_id from ibps_clerk.questions where id=$1`, [s.members[0].id])).rows[0];
  if (!first) { console.log(`  ERR no paper for ${s.src} q${s.lead}`); errors++; continue; }
  const paperId = first.paper_id;
  const assetKey = `${paperId}__q${s.lead}_fig`;
  const storagePath = `ibps/${paperId}/q${s.lead}_fig.png`;
  const publicUrl = `${SURL}/storage/v1/object/public/question-assets/${storagePath}`;
  const block = { kind: "image", url: publicUrl, assetId: assetKey };
  if (APPLY) await upload(storagePath, buf);
  figs++;

  for (const m of s.members) {
    const q = (await c.query(`select id, paper_id, stem, has_images from ibps_clerk.questions where id=$1`, [m.id])).rows[0];
    if (!q) continue;
    const existing = Array.isArray(q.stem) ? q.stem : [];
    if (existing.some((b) => b.kind === "image" && b.url === publicUrl)) continue; // idempotent
    const newStem = [block, ...existing];
    backup.push({ id: q.id, paper_id: q.paper_id, qn: m.qn, stem: q.stem, has_images: q.has_images });
    if (APPLY) {
      await c.query(`update ibps_clerk.questions set stem=$1::jsonb, has_images=true, updated_at=now() where id=$2`,
        [JSON.stringify(newStem), q.id]);
      await c.query(
        `insert into ibps_clerk.question_assets (question_id, paper_id, asset_key, role, ext, storage_path, public_url, sha256, byte_length)
         values ($1,$2,$3,'stem','png',$4,$5,$6,$7) on conflict do nothing`,
        [q.id, q.paper_id, `${paperId}__q${m.qn}_fig`, storagePath, publicUrl, sha, buf.length]
      ).catch(() => {});
    }
    qUpdated++;
  }

  // un-gate every member of this set (the figure makes them answerable)
  const ids = s.members.map((m) => m.id);
  if (APPLY) {
    const r = await c.query(`delete from ibps_clerk.excluded_questions where question_id = any($1::uuid[])`, [ids]);
    ungated += r.rowCount;
  }
}

fs.writeFileSync(path.join(SCRATCH, "ibps_figs_ingest_backup.json"), JSON.stringify(backup, null, 1));
console.log(`[${APPLY ? "APPLY" : "DRY-RUN"}] figures=${figs} questions_updated=${qUpdated} ungated=${ungated} errors=${errors} backup=${backup.length}`);
await c.end();
