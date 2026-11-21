import { expect, it } from "vitest";
import { checkProductPdf, productFileMaxBytes } from "../src/lib/product-files";

it("accepts bounded PDF framing without promising malware validation", () => {
  for (const version of ["1.0", "1.7", "2.0"]) expect(() => checkProductPdf(Buffer.from(`%PDF-${version}\nPDF body\n%%EOF\n`))).not.toThrow();
});
it("rejects oversized, HTML, unsupported-version and incomplete files", () => {
  for (const bytes of [Buffer.alloc(0), Buffer.alloc(productFileMaxBytes+1), Buffer.from('<html>Not a PDF</html>'),
    Buffer.from('%PDF-3.0\nbody\n%%EOF'), Buffer.from('%PDF-1.7\nbody without trailer'), Buffer.from('%PDF-1.7\nbody\n%%EOF<script>')]) expect(() => checkProductPdf(bytes)).toThrow();
});

it("rejects active PDF actions, executable attachments, encrypted or opaque object streams",()=>{
 const dangerous=["/JS (app.alert)","/JavaScript","/OpenAction 2 0 R","/AA << >>","/Launch",
  "/EmbeddedFile","/EmbeddedFiles","/Filespec","/RichMedia","/XFA","/AcroForm",
  "/Encrypt << >>","/ObjStm","/SubmitForm","/GoToR","/Rendition",
  "/J#61vaScript","/#4A#53","/La#75nch","/Ob#6aStm"];
 for(const sample of dangerous) {
  expect(()=>checkProductPdf(Buffer.from("%PDF-1.7\n1 0 obj\n<< "+sample+" >>\nendobj\n%%EOF\n"))).toThrow();
 }
});
it("continues to permit benign text, page content, annotations, and URL links",()=>{
 const pdf=Buffer.from("%PDF-1.7\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R /URI (https://example.com) /Filter /FlateDecode >>\nendobj\n%%EOF\n");
 expect(()=>checkProductPdf(pdf)).not.toThrow();
});
