/**
 * Grant admin to a user by id — credential-free.
 *
 *   ADMIN_USER_ID=<uuid> DATABASE_URL=<postgres-url> npm run admin:grant
 *
 * The id comes from the environment (never committed). No email/password
 * involved: create the user in the Supabase dashboard first (see
 * supabase/ADMIN_SETUP.md), then run this with their id.
 */
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { Client } from "pg";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function resolveConnString(): Promise<string> {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const poolerPath = "supabase/.temp/pooler-url";
  if (existsSync(poolerPath)) return (await readFile(poolerPath, "utf8")).trim();
  throw new Error("Set DATABASE_URL (or link the project so supabase/.temp/pooler-url exists).");
}

async function main() {
  const id = process.env.ADMIN_USER_ID?.trim();
  if (!id) throw new Error("ADMIN_USER_ID env var is required (the user's UUID from the Supabase dashboard).");
  if (!UUID_RE.test(id)) throw new Error(`ADMIN_USER_ID is not a valid UUID: ${id}`);

  const client = new Client({
    connectionString: await resolveConnString(),
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    const res = await client.query(
      "UPDATE public.profiles SET is_admin = true, updated_at = now() WHERE id = $1",
      [id]
    );
    if (res.rowCount === 0) {
      throw new Error(
        `No profile with id ${id}. Create the user in the Supabase dashboard first, then re-run.`
      );
    }
    console.log(`✅ Granted admin to ${id}.`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(`✖ ${(err as Error).message}`);
  process.exit(1);
});
