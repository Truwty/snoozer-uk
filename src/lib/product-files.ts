import { z } from "zod";

export const productFileBucket = "product-files";
export const productFileMaxBytes = 4 * 1024 * 1024;
export const productFile = z.object({ productId: z.uuid(), id: z.uuid(), scope: z.uuid(),
  bytes: z.number().int().min(1).max(productFileMaxBytes), state: z.enum(["pending", "ready", "removing"]) });
export type ProductFile = z.infer<typeof productFile>;
export const productFilePath = (file: ProductFile) => `${file.scope}/${file.id}.pdf`;

// shortcut: framing is not malware scanning; add content scanning before buyer delivery.
export function checkProductPdf(bytes: Uint8Array) {
  if (bytes.length < 16 || bytes.length > productFileMaxBytes) throw new Error("Choose a PDF up to 4 MB.");
  const header = new TextDecoder().decode(bytes.subarray(0, 9));
  const tail = new TextDecoder().decode(bytes.subarray(Math.max(0, bytes.length - 1024)));
  if (!/^%PDF-(1\.[0-7]|2\.0)\s/.test(header) || !/%%EOF[\t\r\n ]*$/.test(tail)) throw new Error("This file does not have PDF framing.");
}
