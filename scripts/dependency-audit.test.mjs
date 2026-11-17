import { test } from "node:test";
import assert from "node:assert/strict";
import { assessAudit } from "./dependency-audit.mjs";

const empty = { auditReportVersion: 2, vulnerabilities: {} };
const report = { auditReportVersion: 2, vulnerabilities: {
  picomatch: { via: [{ name: "picomatch", url: "https://github.com/advisories/GHSA-fc5q-39xc-vjpf" }] },
  vitest: { via: ["picomatch"] },
} };
const date = new Date("2026-11-17T00:00:00Z");
test("exception applies only to the reviewed advisory while production is clean", () => {
  assert.match(assessAudit(report, empty, date), /Development-only/);
  assert.match(assessAudit(empty, empty, date), /zero vulnerabilities/);
  assert.throws(() => assessAudit(report, report, date), /Production/);
  assert.throws(() => assessAudit({ ...report, vulnerabilities: { new: { via: [{ name: "other", url: "unknown" }] } } }, empty, date), /unreviewed/);
  assert.throws(() => assessAudit({ ...report, vulnerabilities: { ...report.vulnerabilities, unknown: { via: ["missing"] } } }, empty, date), /provenance/);
});
test("expired exceptions and incomplete audit responses fail closed", () => {
  assert.throws(() => assessAudit(report, empty, new Date("2026-12-01T00:00:00Z")), /expired/);
  assert.throws(() => assessAudit({ error: "offline" }, empty, date), /Invalid/);
  assert.throws(() => assessAudit({ ...empty, vulnerabilities: { unresolved: { via: ["unknown"] } } }, empty, date), /provenance/);
});
