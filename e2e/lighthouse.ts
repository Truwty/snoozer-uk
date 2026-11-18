import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, type Page } from "@playwright/test";

export async function checkLighthouse(page: Page, path: string) {
  if (process.env.SNOOZER_TEST_LIGHTHOUSE !== "1") return;
  const origin = "http://localhost:3000";
  const url = new URL(path, origin);
  if (url.origin !== origin || !process.env.npm_execpath) throw new Error("Lighthouse is restricted to the disposable loopback app.");
  const folder = await mkdtemp(join(tmpdir(), "snoozer-lighthouse-"));
  try {
    const headers = join(folder, "headers.json");
    const report = join(folder, "report.json");
    const cookies = await page.context().cookies(origin);
    // Fixture session only; never put cookies in arguments, logs or retained reports.
    await writeFile(headers, JSON.stringify({ Cookie: cookies.map((cookie) => cookie.name + "=" + cookie.value).join("; ") }));
    execFileSync(process.execPath, [process.env.npm_execpath, "exec", "--yes", "--package=lighthouse@13.6.0", "--",
      "lighthouse", url.href, "--only-categories=accessibility", "--output=json", "--output-path=" + report,
      "--extra-headers=" + headers, "--disable-storage-reset", "--quiet", "--chrome-flags=--headless --no-sandbox"],
    { timeout: 120000, stdio: "pipe" });
    const result = JSON.parse(await readFile(report, "utf8"));
    expect(new URL(result.finalDisplayedUrl).pathname).toBe(url.pathname);
    const score = result.categories.accessibility.score * 100;
    console.log(`Lighthouse accessibility ${url.pathname}: ${score}`);
    expect(score).toBeGreaterThanOrEqual(95);
  } finally {
    if (!folder.startsWith(join(tmpdir(), "snoozer-lighthouse-"))) throw new Error("Unexpected temporary audit directory");
    await rm(folder, { recursive: true, force: true });
  }
}
