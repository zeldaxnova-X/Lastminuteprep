/**
 * Unit tests for prose sanitization (no em dashes site-wide). Run: `npm test`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { sanitizeProse } from "./deepseek";

test("em dash becomes a comma clause", () => {
  assert.equal(sanitizeProse("34% accuracy—your lowest topic"), "34% accuracy, your lowest topic");
});

test("en dash in prose becomes a comma clause", () => {
  assert.equal(sanitizeProse("solid work – keep going"), "solid work, keep going");
});

test("numeric range collapses to a hyphen, not a comma", () => {
  assert.equal(sanitizeProse("papers from 2020–2024"), "papers from 2020-2024");
});

test("leaves clean text untouched", () => {
  const clean = "Reasoning is your anchor at 72% accuracy.";
  assert.equal(sanitizeProse(clean), clean);
});

test("handles multiple dashes in one string", () => {
  assert.equal(
    sanitizeProse("Quant—weak; English—strong"),
    "Quant, weak; English, strong"
  );
});
