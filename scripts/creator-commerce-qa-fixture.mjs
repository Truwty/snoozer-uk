import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Deterministic, self-contained PDF: no form fields, embedded files, scripts,
// URLs, personal details, external fonts or uploaded customer material.
const lines = [
  "SNOOZER / CREATOR COMMERCE",
  "ISOLATED SANDBOX QA FIXTURE",
  "NOT A REAL PRODUCT",
  "This file tests paid digital-download delivery only.",
  "No customer details, passwords or financial data are included.",
  "Review the exact bytes before enabling a test offer.",
  "Test fixture ID: SNOOZER-CREATOR-QA-V1",
];
const text = (font, size, x, y, value) =>
  `BT /${font} ${size} Tf 1 0 0 1 ${x} ${y} Tm (${value}) Tj ET`;

export function buildCreatorQaPdf() {
  const stream = [
    "q",
    "0.045 0.070 0.074 rg 0 0 595 842 re f",
    "0.66 0.98 0.68 rg 0 650 595 192 re f",
    "0.065 0.16 0.11 rg",
    text("F2", 24, 50, 766, lines[0]),
    text("F2", 22, 50, 719, lines[1]),
    "0.92 0.98 0.94 rg",
    text("F2", 21, 50, 581, lines[2]),
    text("F1", 13, 50, 526, lines[3]),
    text("F1", 12, 50, 499, lines[4]),
    text("F1", 12, 50, 472, lines[5]),
    "0.66 0.98 0.68 rg",
    text("F2", 12, 50, 366, lines[6]),
    "0.46 0.65 0.53 rg",
    text("F1", 11, 50, 86, "One page. Static text. Synthetic QA content only."),
    "Q",
  ].join("\n") + "\n";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
    `<< /Length ${Buffer.byteLength(stream, "ascii")} >>\nstream\n${stream}endstream`,
  ];
  let source = "%PDF-1.4\n%Snoozer-QA\n";
  const offsets = [];
  for (let index = 0; index < objects.length; index++) {
    offsets.push(Buffer.byteLength(source, "ascii"));
    source += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`;
  }
  const xref = Buffer.byteLength(source, "ascii");
  source += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) source += `${String(offset).padStart(10, "0")} 00000 n \n`;
  source += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  const bytes = Buffer.from(source, "ascii");
  if (bytes.length > 4 * 1024 * 1024) throw new Error("PDF exceeds the private product limit.");
  return bytes;
}
export function qaPdfSha256(bytes = buildCreatorQaPdf()) {
  return createHash("sha256").update(bytes).digest("hex");
}
const invoked = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  const args = process.argv.slice(2);
  const valid = args.length === 0 || (args.length === 2 && args[0] === "--output" && args[1].endsWith(".pdf"));
  if (!valid) {
    console.error("Usage: npm run commerce:qa:fixture -- [--output <new-file.pdf>]");
    process.exitCode = 2;
  } else {
    const destination = resolve(args[1] || "test-results/creator-commerce/isolated-qa-fixture.pdf");
    try {
      const bytes = buildCreatorQaPdf();
      await mkdir(dirname(destination), { recursive: true });
      // Never overwrite an operator-reviewed or already-uploaded file.
      await writeFile(destination, bytes, { flag: "wx", mode: 0o600 });
      console.log("Sandbox-only fixture PDF created.");
      console.log("Path: " + destination);
      console.log("Bytes: " + bytes.length);
      console.log("SHA-256: " + qaPdfSha256(bytes));
      console.log("This file is not approved or published; upload and review it manually.");
    } catch {
      console.error("Cannot create the fixture. Delete or rename any existing output; never overwrite an approved copy.");
      process.exitCode = 1;
    }
  }
}
