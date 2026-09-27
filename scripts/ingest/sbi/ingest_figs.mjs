// Attach the cleaned SBI DI figures to their questions so the DI sets are answerable.
//   - charts  -> upload the cleaned PNG, prepend an {kind:image} block to every question
//                in the DI set, set has_images=true, record a question_assets row.
//   - tables  -> prepend a {kind:table, rows} block to every question in the DI set.
// Backs up every affected question first. Dry-run unless --apply.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import pg from "pg";
const APPLY = process.argv.includes("--apply");
const SCRATCH = "C:/Users/jijo1/AppData/Local/Temp/claude/C--Users-jijo1-OneDrive-Desktop-Lastmileprep/e444d752-aabc-46fe-af74-5a2e83e5dc78/scratchpad";
const FIGDIR = path.join(SCRATCH, "sbi_ingest_figs");
const env = fs.readFileSync(".env.local", "utf8");
const DBURL = env.match(/DATABASE_URL="?([^"\n\r]+)/)[1].trim();
const SURL = env.match(/NEXT_PUBLIC_SUPABASE_URL="?([^"\n\r]+)/)[1].trim();
const SKEY = env.match(/SUPABASE_SERVICE_ROLE_KEY="?([^"\n\r]+)/)[1].trim();
const figs = JSON.parse(fs.readFileSync(path.join(SCRATCH, "sbi_ingest_figs.json"), "utf8"));

// transcribed table data, keyed by paper_id substring + lead qn
const TABLES = {
  "0cb20b5|46": [["Months/Hospitals","March","April","May"],["A","3500","4900","6400"],["B","4400","6450","3870"],["C","4962","7345","4365"]],
  "ac32d2|44": [["Days/Malls","Mall A","Mall B","Mall C","Mall D"],["Friday","380","280","280","320"],["Saturday","220","300","360","340"],["Sunday","240","380","260","320"]],
  "42931151|40": [["Scheme","Amount invested by Chutki (in Rs.)","Amount invested by Indumathi (in Rs.)"],["LIC","29500","19500"],["NPS","27500","12500"],["ELSS","18500","24500"]],
  "af627cd|41": [["Name of the person","A","B","C","D","E"],["P","44","48","56","68","72"],["Q","80","52","42","76","64"],["R","58","66","38","62","78"]],
  "d3957d|61": [["Societies","Male","Female"],["A","200","250"],["B","350","500"],["C","250","300"],["D","300","150"],["E","400","200"]],
  "2d919e|58": [["Companies","Headphone","Adaptor","Charger"],["I","500","150","150"],["J","650","100","200"],["K","750","100","300"],["L","800","200","400"],["M","500","250","500"]],
};
function tableFor(f) {
  for (const k in TABLES) { const [sub, qn] = k.split("|"); if (f.paper_id.includes(sub) && f.lead_qn === Number(qn)) return TABLES[k]; }
  return null;
}
async function upload(storagePath, buf) {
  const res = await fetch(`${SURL}/storage/v1/object/question-assets/${storagePath}`, {
    method: "POST", headers: { apikey: SKEY, Authorization: "Bearer " + SKEY, "Content-Type": "image/png", "x-upsert": "true" }, body: buf });
  if (!res.ok) throw new Error("upload " + res.status + " " + (await res.text()).slice(0, 150));
}

const c = new pg.Client({ connectionString: DBURL, ssl: { rejectUnauthorized: false } });
await c.connect();
const backup = [];
let charts = 0, tables = 0, qUpdated = 0;

for (const f of figs) {
  const rows = f.set_range && f.set_range.length ? f.set_range : [f.lead_qn];
  const tbl = tableFor(f);
  const isChart = !tbl;
  let block, storagePath = null, publicUrl = null, sha = null, blen = null;
  if (isChart) {
    const buf = fs.readFileSync(path.join(FIGDIR, f.img));
    sha = crypto.createHash("sha256").update(buf).digest("hex"); blen = buf.length;
    storagePath = `${f.paper_id}/${f.paper_id}__q${f.lead_qn}_fig.png`;
    publicUrl = `${SURL}/storage/v1/object/public/question-assets/${storagePath}`;
    if (APPLY) await upload(storagePath, buf);
    block = { kind: "image", url: publicUrl, assetId: `${f.paper_id}__q${f.lead_qn}_fig` };
    charts++;
  } else {
    block = { kind: "table", rows: tbl };
    tables++;
  }
  for (const qn of rows) {
    const q = (await c.query(`select id, stem, has_images from sbi_clerk.questions where paper_id=$1 and question_number=$2`, [f.paper_id, qn])).rows[0];
    if (!q) continue;
    const existing = Array.isArray(q.stem) ? q.stem : [];
    if (existing.some((b) => (b.kind === "image" && b.url === publicUrl) || (b.kind === "table"))) continue; // idempotent
    const newStem = [block, ...existing];
    backup.push({ id: q.id, paper_id: f.paper_id, question_number: qn, stem: q.stem, has_images: q.has_images });
    if (APPLY) {
      await c.query(`update sbi_clerk.questions set stem=$1::jsonb, has_images=$2, updated_at=now() where id=$3`,
        [JSON.stringify(newStem), isChart ? true : q.has_images, q.id]);
      if (isChart) {
        await c.query(
          `insert into sbi_clerk.question_assets (question_id, paper_id, asset_key, role, ext, storage_path, public_url, sha256, byte_length)
           values ($1,$2,$3,'stem','png',$4,$5,$6,$7) on conflict do nothing`,
          [q.id, f.paper_id, `${f.paper_id}__q${qn}_fig`, storagePath, publicUrl, sha, blen]
        ).catch(() => {}); // bookkeeping only; renderer reads stem blocks
      }
    }
    qUpdated++;
  }
}
fs.writeFileSync(path.join(SCRATCH, "sbi_ingest_backup.json"), JSON.stringify(backup, null, 1));
console.log(`[${APPLY ? "APPLY" : "DRY-RUN"}] charts=${charts} tables=${tables} questions updated=${qUpdated} backup=${backup.length}`);
await c.end();
