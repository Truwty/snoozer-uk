import { z } from "zod";

export const productFileBucket = "product-files";
export const productFileMaxBytes = 4 * 1024 * 1024;
export const productFile = z.object({ productId: z.uuid(), id: z.uuid(), scope: z.uuid(),
  bytes: z.number().int().min(1).max(productFileMaxBytes), state: z.enum(["pending", "ready", "removing"]) });
export type ProductFile = z.infer<typeof productFile>;
export const productFilePath = (file: ProductFile) => `${file.scope}/${file.id}.pdf`;

/**
 * Conservative static PDF active-content screening, not an antivirus scan
 * or substitute for full PDF parsing/content moderation.
 *
 * PDF name escape sequences are normalised. Opaque compressed object
 * dictionaries are rejected because their names cannot be inspected here.
 */
const unsafePdfNames = new Set([
  "js", "javascript", "aa", "openaction", "launch", "embeddedfile", "embeddedfiles",
  "filespec", "richmedia", "xfa", "acroform", "encrypt", "objstm",
  "submitform", "importdata", "gotor", "rendition", "3d", "3dview",
]);
function assertStaticProductPdf(bytes: Uint8Array) {
  const document = new TextDecoder("windows-1252").decode(bytes);
  const tokens = document.matchAll(/\/(?:#[0-9a-fA-F]{2}|[A-Za-z0-9_.-]){1,100}/g);
  for (const match of tokens) {
    const name = match[0].slice(1).replace(/#([0-9a-fA-F]{2})/g,
      (_, code: string) => String.fromCharCode(Number.parseInt(code, 16))).toLowerCase();
    if (unsafePdfNames.has(name)) throw new Error("PDF contains active or unsupported content.");
  }
}
// Framing and static screening are both required at upload/freeze.
// Neither is a malware scan: independent AV/moderation remain outstanding.
export function checkProductPdf(bytes: Uint8Array) {
  if (bytes.length < 16 || bytes.length > productFileMaxBytes) throw new Error("Choose a PDF up to 4 MB.");
  const header = new TextDecoder().decode(bytes.subarray(0, 9));
  const tail = new TextDecoder().decode(bytes.subarray(Math.max(0, bytes.length - 1024)));
  if (!/^%PDF-(1\.[0-7]|2\.0)\s/.test(header) || !/%%EOF[\t\r\n ]*$/.test(tail)) throw new Error("This file does not have PDF framing.");
  assertStaticProductPdf(bytes);
}
