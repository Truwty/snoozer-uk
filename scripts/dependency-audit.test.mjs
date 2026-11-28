import { test } from "node:test";
import assert from "node:assert/strict";
import { assessAudit } from "./dependency-audit.mjs";

const empty = { auditReportVersion: 2, vulnerabilities: {} };
const developmentFinding = {
  auditReportVersion: 2,
  vulnerabilities: {
    picomatch: {
      via: [{ name: "picomatch", url: "https://github.com/advisories/GHSA-fc5q-39xc-vjpf" }],
    },
  },
};
const productionFinding = {
  auditReportVersion: 2,
  vulnerabilities: {
    next: { via: [{ name: "next", url: "https://example.invalid/advisory" }] },
  },
};

test("only clean full and production reports pass", () => {
  assert.match(assessAudit(empty, empty), /zero vulnerabilities/);
  assert.throws(() => assessAudit(developmentFinding, empty), /Development and production/);
  assert.throws(() => assessAudit(productionFinding, productionFinding), /Production/);
});

test("incomplete and unavailable audit responses fail closed", () => {
  assert.throws(() => assessAudit({ error: "offline" }, empty), /Invalid/);
  assert.throws(() => assessAudit({ ...empty, vulnerabilities: null }, empty), /Invalid/);
  assert.throws(() => assessAudit({ ...empty, auditReportVersion: 1 }, empty), /Invalid/);
});
