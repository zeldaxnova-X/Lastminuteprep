/**
 * Integration test for the single critical funnel step: an anonymous attempt must
 * survive signup. Exercises the claim_anonymous_attempts RPC directly against the
 * database, with full cleanup. Skips when DATABASE_URL isn't available.
 *
 * Covers, per spec:
 *   • claim attaches the anonymous attempt (+ canonical mirror + sample ledger)
 *   • idempotency (a second call — e.g. a page refresh or a new tab firing
 *     /api/auth/me again — claims nothing more and doesn't error)
 *   • isolation (claiming device A never touches an attempt on device B —
 *     e.g. an existing account with its own device history)
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { Client } from "pg";

function dbUrl(): string | null {
  try {
    const env = readFileSync(".env.local", "utf8");
    const m = env.match(/DATABASE_URL="?([^"\n\r]+)/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

const URL = dbUrl();
const run = URL ? test : test.skip;

let client: Client;
const deviceA = `test_dev_${randomUUID()}`;
const deviceB = `test_dev_${randomUUID()}`;
const userA = randomUUID();
const attemptA = randomUUID();
const attemptB = randomUUID();

before(async () => {
  if (!URL) return;
  client = new Client({ connectionString: URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  // Anonymous attempt on device A (+ canonical mirror + sample ledger).
  await client.query(
    `insert into exam_attempts (id, user_id, device_id, exam_type, title, total_questions, status, max_score)
     values ($1, null, $2, 'random_test', 'claim-test A', 100, 'completed', 200)`,
    [attemptA, deviceA]
  );
  await client.query(
    `insert into test_sessions (id, user_id, device_id, mode, status, started_at)
     values ($1, null, $2, 'random', 'submitted', now())`,
    [attemptA, deviceA]
  );
  await client.query(
    `insert into sample_attempts (device_token, attempt_id) values ($1, $2)`,
    [deviceA, attemptA]
  );
  // A separate anonymous attempt on device B (must be left untouched).
  await client.query(
    `insert into exam_attempts (id, user_id, device_id, exam_type, title, total_questions, status, max_score)
     values ($1, null, $2, 'random_test', 'claim-test B', 100, 'completed', 200)`,
    [attemptB, deviceB]
  );
});

after(async () => {
  if (!URL) return;
  await client.query(`delete from test_sessions where id = any($1::uuid[])`, [[attemptA, attemptB]]);
  await client.query(`delete from sample_attempts where device_token = any($1::text[])`, [[deviceA, deviceB]]);
  await client.query(`delete from exam_attempts where id = any($1::uuid[])`, [[attemptA, attemptB]]);
  await client.end();
});

run("claim attaches the anonymous attempt to the user (survives signup)", async () => {
  const { rows } = await client.query(`select claim_anonymous_attempts($1, $2) as n`, [userA, deviceA]);
  assert.equal(Number(rows[0].n), 1, "exactly one attempt claimed");

  const ea = await client.query(`select user_id, device_id from exam_attempts where id = $1`, [attemptA]);
  assert.equal(ea.rows[0].user_id, userA, "exam_attempts reassigned to the user");
  assert.equal(ea.rows[0].device_id, null, "device_id cleared");

  const ts = await client.query(`select user_id from test_sessions where id = $1`, [attemptA]);
  assert.equal(ts.rows[0].user_id, userA, "canonical mirror reassigned too");

  const sa = await client.query(`select claimed_by from sample_attempts where device_token = $1`, [deviceA]);
  assert.equal(sa.rows[0].claimed_by, userA, "sample ledger stamped");
});

run("claim is idempotent (refresh / new tab re-firing the claim)", async () => {
  const { rows } = await client.query(`select claim_anonymous_attempts($1, $2) as n`, [userA, deviceA]);
  assert.equal(Number(rows[0].n), 0, "nothing left to claim on a second call");
});

run("claim never touches another device's attempt (existing-account isolation)", async () => {
  const eb = await client.query(`select user_id from exam_attempts where id = $1`, [attemptB]);
  assert.equal(eb.rows[0].user_id, null, "device B's anonymous attempt is untouched");
});

run("claiming with a blank device is a no-op", async () => {
  const { rows } = await client.query(`select claim_anonymous_attempts($1, $2) as n`, [userA, ""]);
  assert.equal(Number(rows[0].n), 0);
});
