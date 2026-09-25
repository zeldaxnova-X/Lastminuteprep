/**
 * GUARDRAIL (build-failing): no application code may reach across exam content
 * namespaces. Exam content lives in per-exam Postgres schemas (ssc_cgl,
 * sbi_clerk, …) and is read ONLY through the exam-scoped repository
 * (content-repo.ts), which resolves a single exam's public objects. Any other
 * module that names a content schema directly, or a `<code>__` content view, or
 * queries two exam schemas together, can leak one exam's content into another's
 * context — so this test scans src/ and fails if it finds one.
 *
 * Allowed to name schemas: the registry (declares each exam's schema) and the
 * repository (resolves object names). Everything else must go through the repo.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const SRC = join(process.cwd(), "src");

// Files permitted to reference a content schema by name.
const ALLOWLIST = [
  join("lib", "exam", "registry.ts"),
  join("lib", "exam", "content-repo.ts"),
  // Tests may reference names to assert on them.
  ".test.ts",
];

// Known exam content schemas. Add new exams here as they launch.
const CONTENT_SCHEMAS = ["ssc_cgl", "sbi_clerk", "ibps_clerk", "jee_main", "neet_ug"];

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) out.push(...walk(p));
    else if (p.endsWith(".ts") || p.endsWith(".tsx")) out.push(p);
  }
  return out;
}

function isAllowed(file: string): boolean {
  return ALLOWLIST.some((a) => file.includes(a));
}

test("no module outside the repository names an exam content schema", () => {
  const violations: string[] = [];
  // Matches `ssc_cgl.`, `schema("ssc_cgl")`, etc. for any known content schema.
  const schemaRe = new RegExp(`\\b(${CONTENT_SCHEMAS.join("|")})\\b\\s*[.")]`);
  for (const file of walk(SRC)) {
    if (isAllowed(file)) continue;
    const text = readFileSync(file, "utf8");
    if (schemaRe.test(text)) {
      const line = text.split("\n").findIndex((l) => schemaRe.test(l)) + 1;
      violations.push(`${file.replace(process.cwd(), ".")}:${line}`);
    }
  }
  assert.deepEqual(
    violations,
    [],
    `Content schemas must only be named in the registry/repository. Route these reads through examContent(). Offenders:\n${violations.join("\n")}`
  );
});

test("no query mixes two exams' `<code>__` content views", () => {
  // A single string/template naming two different `<code>__<object>` views would
  // be a cross-exam read. Flag any file with 2+ distinct exam prefixes on the
  // same content object.
  const viewRe = /\b([a-z]+_[a-z]+)__(questions|papers|cbt_valid_questions|validated_questions|question_assets|excluded_questions)\b/g;
  const violations: string[] = [];
  for (const file of walk(SRC)) {
    if (isAllowed(file)) continue;
    const text = readFileSync(file, "utf8");
    const prefixes = new Set<string>();
    for (const m of text.matchAll(viewRe)) prefixes.add(m[1]);
    if (prefixes.size >= 1) {
      // Any `<code>__` content view outside the repo is itself a violation.
      violations.push(`${file.replace(process.cwd(), ".")} (${[...prefixes].join(", ")})`);
    }
  }
  assert.deepEqual(violations, [], `Per-exam content views must only be built in content-repo.ts. Offenders:\n${violations.join("\n")}`);
});
