import { test } from "node:test";
import assert from "node:assert/strict";
import { decideReportAccess } from "./entitlements";

const U = "11111111-1111-1111-1111-111111111111";
const OTHER = "22222222-2222-2222-2222-222222222222";

test("anonymous caller gets headline only (never the full report)", () => {
  const d = decideReportAccess({
    authenticated: false,
    viewerId: null,
    plan: "free",
    attemptUserId: null,
    unlocked: false,
  });
  assert.equal(d.full, false);
  assert.equal(d.reason, "anonymous");
});

test("signed-in owner on free plan, no unlock → locked (headline only)", () => {
  const d = decideReportAccess({
    authenticated: true,
    viewerId: U,
    plan: "free",
    attemptUserId: U,
    unlocked: false,
  });
  assert.equal(d.full, false);
  assert.equal(d.isOwner, true);
  assert.equal(d.reason, "locked");
});

test("signed-in owner on free plan WITH ₹9 unlock → full report", () => {
  const d = decideReportAccess({
    authenticated: true,
    viewerId: U,
    plan: "free",
    attemptUserId: U,
    unlocked: true,
  });
  assert.equal(d.full, true);
  assert.equal(d.reason, null);
});

test("All-Access (mentor) owner → full report without any per-attempt unlock", () => {
  const d = decideReportAccess({
    authenticated: true,
    viewerId: U,
    plan: "mentor",
    attemptUserId: U,
    unlocked: false,
  });
  assert.equal(d.full, true);
});

test("pro plan owner → full report (All-Access rank ≥ pro)", () => {
  const d = decideReportAccess({
    authenticated: true,
    viewerId: U,
    plan: "pro",
    attemptUserId: U,
    unlocked: false,
  });
  assert.equal(d.full, true);
});

test("a signed-in user can never see someone else's report, even paid + unlocked", () => {
  const d = decideReportAccess({
    authenticated: true,
    viewerId: U,
    plan: "mentor",
    attemptUserId: OTHER,
    unlocked: true,
  });
  assert.equal(d.full, false);
  assert.equal(d.reason, "not_owner");
});
