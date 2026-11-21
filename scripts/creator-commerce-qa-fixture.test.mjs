import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildCreatorQaPdf, qaPdfSha256 } from "./creator-commerce-qa-fixture.mjs";

test("generated isolated QA PDF is reproducible, one-page and passes private-file framing", () => {
  const first = buildCreatorQaPdf(), second = buildCreatorQaPdf();
  assert.deepEqual(first, second);
  assert.ok(first.length > 500 && first.length < 4096);
  const source = first.toString("ascii");
  assert.match(source, /^%PDF-1\.4\n/);
  assert.match(source, /\/Type \/Pages \/Kids \[3 0 R\] \/Count 1/);
  assert.match(source, /\/MediaBox \[0 0 595 842\]/);
  assert.match(source, /SNOOZER \/ CREATOR COMMERCE/);
  assert.match(source, /ISOLATED SANDBOX QA FIXTURE/);
  assert.match(source, /NOT A REAL PRODUCT/);
  assert.match(source, /%%EOF\n$/);
  assert.equal(qaPdfSha256(first), createHash("sha256").update(first).digest("hex"));
});

test("PDF object offsets and xref are correctly located and the file has no active content", () => {
  const source = buildCreatorQaPdf().toString("ascii");
  const xref = /startxref\n(\d+)\n%%EOF\n$/.exec(source);
  assert.ok(xref);
  const offset = Number(xref[1]);
  assert.equal(source.slice(offset, offset + 5), "xref\n");
  const rows = source.slice(offset).split("\n");
  assert.equal(rows[1], "0 7");
  assert.equal(rows[2], "0000000000 65535 f ");
  for (let object = 1; object <= 6; object++) {
    const pointer = Number(rows[object + 2].slice(0, 10));
    assert.equal(source.slice(pointer, pointer + 7), `${object} 0 obj`);
  }
  for (const forbidden of [/\/JavaScript/i, /\/EmbeddedFile/i, /\/URI\b/i, /\/OpenAction/i, /\/Launch\b/i, /\/AcroForm/i]) {
    assert.doesNotMatch(source, forbidden);
  }
});

test("fixture CLI writes a new PDF and refuses to replace its approved exact bytes", () => {
  const folder = mkdtempSync(join(tmpdir(), "snoozer-qa-fixture-"));
  try {
    const dest = join(folder, "sandbox.pdf");
    const file = new URL("./creator-commerce-qa-fixture.mjs", import.meta.url);
    const once = spawnSync(process.execPath, [file.pathname, "--output", dest], { encoding: "utf8" });
    assert.equal(once.status, 0, once.stderr);
    assert.match(once.stdout, /Sandbox-only fixture PDF created/);
    const bytes = readFileSync(dest);
    assert.deepEqual(bytes, buildCreatorQaPdf());
    assert.match(once.stdout, new RegExp(qaPdfSha256(bytes)));
    const again = spawnSync(process.execPath, [file.pathname, "--output", dest], { encoding: "utf8" });
    assert.equal(again.status, 1);
    assert.deepEqual(readFileSync(dest), bytes);
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});
