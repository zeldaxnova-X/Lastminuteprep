/**
 * GUARDRAILS (live DB): a generated SBI Clerk Prelims mock must
 *   (1) contain ONLY SBI question ids — zero SSC (ssc_cgl) ids, and
 *   (2) match the SBI blueprint exactly (section counts + total marks).
 * Skips when DATABASE_URL isn't available.
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Client } from "pg";
import { SBI_CLERK_PRELIMS_CONFIG, orderedSections } from "./exam-config";
import { checkPaperConformance, type PaperQuestion } from "./blueprint";

function dbUrl(): string | null {
  try {
    const m = readFileSync(".env.local", "utf8").match(/DATABASE_URL="?([^"\n\r]+)/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}
const URL = dbUrl();
const run = URL ? test : test.skip;
let client: Client;

before(async () => {
  if (!URL) return;
  client = new Client({ connectionString: URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
});
after(async () => {
  if (URL) await client.end();
});

/** Generate a mock the same way the start route does: per-section pull from the
 *  exam's OWN cbt_valid view. */
async function generateSbiMock(): Promise<{ id: string; section: string }[]> {
  const out: { id: string; section: string }[] = [];
  for (const s of orderedSections(SBI_CLERK_PRELIMS_CONFIG)) {
    const { rows } = await client.query(
      `select id, section_slug from public.sbi_clerk__cbt_valid_questions
       where section_slug = $1 order by random() limit $2`,
      [s.key, s.questionCount]
    );
    for (const r of rows) out.push({ id: r.id, section: r.section_slug });
  }
  return out;
}

run("a generated SBI mock contains zero SSC question ids", async () => {
  const mock = await generateSbiMock();
  const ids = mock.map((q) => q.id);
  assert.ok(ids.length > 0, "generated an empty mock");
  // Every id must exist in the SBI content...
  const inSbi = await client.query(`select count(*)::int n from sbi_clerk.questions where id = any($1::uuid[])`, [ids]);
  assert.equal(inSbi.rows[0].n, ids.length, "all ids are SBI questions");
  // ...and NONE may exist in SSC content.
  const inSsc = await client.query(`select count(*)::int n from ssc_cgl.questions where id = any($1::uuid[])`, [ids]);
  assert.equal(inSsc.rows[0].n, 0, "no SSC ids leaked into the SBI mock");
});

run("a generated SBI mock matches the SBI blueprint exactly", async () => {
  const mock = await generateSbiMock();
  const paper: PaperQuestion[] = mock.map((q) => ({ section: q.section }));
  const r = checkPaperConformance(paper, SBI_CLERK_PRELIMS_CONFIG);
  assert.equal(r.ok, true, r.errors.join("; "));
  assert.equal(r.totalQuestions, 100);
  assert.equal(r.totalMarks, 100); // SBI Prelims: 100 Q × 1 mark
  assert.deepEqual(
    r.perSection,
    { english: 30, numerical_ability: 35, reasoning: 35 }
  );
});
