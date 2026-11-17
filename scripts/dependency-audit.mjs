import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const exception = "https://github.com/advisories/GHSA-fc5q-39xc-vjpf";
export function assessAudit(report, production, now = new Date()) {
  if (report?.auditReportVersion !== 2 || production?.auditReportVersion !== 2
    || !report.vulnerabilities || !production.vulnerabilities || report.error || production.error) {
    throw new Error("Invalid dependency audit response.");
  }
  if (Object.keys(production.vulnerabilities).length) throw new Error("Production dependency vulnerabilities must be fixed.");
  const advisories = Object.values(report.vulnerabilities).flatMap((entry) => entry.via);
  if (advisories.some((entry) => typeof entry === "string" && !report.vulnerabilities[entry])) {
    throw new Error("Audit dependency provenance is incomplete.");
  }
  const direct = advisories.filter((entry) => typeof entry === "object" && entry);
  if (advisories.length && !direct.length) throw new Error("Audit did not provide advisory provenance.");
  if (direct.some((entry) => entry.url !== exception || entry.name !== "picomatch")) {
    throw new Error("An unreviewed dependency advisory requires attention.");
  }
  if (direct.length && now >= new Date("2026-12-01T00:00:00Z")) {
    throw new Error("The development-only picomatch exception expired. Review upstream and remove or re-approve it.");
  }
  return direct.length ? "Development-only picomatch exception applies until 1 December 2026. Production audit: zero vulnerabilities."
    : "Dependency audit: zero vulnerabilities.";
}

function audit(omitDev) {
  const npmCli = process.env.npm_execpath ?? join(dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js");
  const result = spawnSync(process.execPath,
    [npmCli, "audit", "--json", ...(omitDev ? ["--omit=dev"] : [])],
    { encoding: "utf8", timeout: 60000, maxBuffer: 5 * 1024 * 1024 });
  if (result.error || ![0, 1].includes(result.status)) throw new Error("Dependency audit could not run.");
  return JSON.parse(result.stdout);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log(assessAudit(audit(false), audit(true)));
}
