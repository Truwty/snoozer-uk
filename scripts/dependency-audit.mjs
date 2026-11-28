import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

export function assessAudit(report, production) {
  if (report?.auditReportVersion !== 2 || production?.auditReportVersion !== 2
    || !report.vulnerabilities || !production.vulnerabilities || report.error || production.error) {
    throw new Error("Invalid dependency audit response.");
  }

  const productionFindings = Object.keys(production.vulnerabilities);
  if (productionFindings.length) {
    throw new Error("Production dependency vulnerabilities must be fixed.");
  }

  const allFindings = Object.keys(report.vulnerabilities);
  if (allFindings.length) {
    throw new Error("Development and production dependency vulnerabilities must be fixed.");
  }

  return "Dependency audit: zero vulnerabilities in the full and production dependency trees.";
}

function audit(omitDev) {
  const npmCli = process.env.npm_execpath
    ?? join(dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js");
  const result = spawnSync(
    process.execPath,
    [npmCli, "audit", "--json", ...(omitDev ? ["--omit=dev"] : [])],
    { encoding: "utf8", timeout: 60000, maxBuffer: 5 * 1024 * 1024 },
  );

  if (result.error || ![0, 1].includes(result.status)) {
    throw new Error("Dependency audit could not run.");
  }

  try {
    return JSON.parse(result.stdout);
  } catch {
    throw new Error("Dependency audit returned invalid JSON.");
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log(assessAudit(audit(false), audit(true)));
}
