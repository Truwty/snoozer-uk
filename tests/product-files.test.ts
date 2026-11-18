import { expect, it } from "vitest";
import { checkProductPdf, productFileMaxBytes } from "../src/lib/product-files";

it("accepts bounded PDF framing without promising malware validation", () => {
  for (const version of ["1.0", "1.7", "2.0"]) expect(() => checkProductPdf(Buffer.from(`%PDF-${version}\nPDF body\n%%EOF\n`))).not.toThrow();
});
it("rejects oversized, HTML, unsupported-version and incomplete files", () => {
  for (const bytes of [Buffer.alloc(0), Buffer.alloc(productFileMaxBytes+1), Buffer.from('<html>Not a PDF</html>'),
    Buffer.from('%PDF-3.0\nbody\n%%EOF'), Buffer.from('%PDF-1.7\nbody without trailer'), Buffer.from('%PDF-1.7\nbody\n%%EOF<script>')]) expect(() => checkProductPdf(bytes)).toThrow();
});
