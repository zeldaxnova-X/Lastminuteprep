/**
 * Minimal Postgres executor for applying migrations / running ad-hoc SQL against
 * the linked Supabase project.
 *
 *   npm run db:exec -- --file supabase/migrations/<name>.sql   # apply a file in a txn
 *   npm run db:exec -- --sql "select count(*) from public.papers"  # run a query
 *
 * Connection string resolution order:
 *   1. DATABASE_URL env
 *   2. supabase/.temp/pooler-url (written by `supabase link`)
 */
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { Client } from "pg";

async function resolveConnString(): Promise<string> {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const poolerPath = "supabase/.temp/pooler-url";
  if (existsSync(poolerPath)) return (await readFile(poolerPath, "utf8")).trim();
  throw new Error("No DATABASE_URL and no supabase/.temp/pooler-url found.");
}

async function main() {
  const argv = process.argv.slice(2);
  let file = "";
  let sql = "";
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--file") file = argv[++i];
    else if (argv[i] === "--sql") sql = argv[++i];
  }
  if (!file && !sql) throw new Error("Usage: db:exec -- (--file <path.sql> | --sql <query>)");

  const client = new Client({
    connectionString: await resolveConnString(),
    ssl: { rejectUnauthorized: false },
    // pooler DDL can take a moment
    statement_timeout: 120000,
  });
  await client.connect();
  try {
    if (sql) {
      const res = await client.query(sql);
      console.table(res.rows);
      return;
    }
    const text = await readFile(file, "utf8");
    console.log(`Applying ${file} in a transaction …`);
    await client.query("BEGIN");
    try {
      await client.query(text);
      await client.query("COMMIT");
      console.log("✅ Migration applied and committed.");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(`\n✖ ${(err as Error).message}`);
  process.exit(1);
});
