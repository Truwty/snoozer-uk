import { z } from "zod";
import { productAmount, productDescription, productTitle } from "./products";
import { productFileMaxBytes } from "./product-files";

export const productVersion = z.object({ id: z.uuid(), productId: z.uuid(), fileId: z.uuid(), revision: z.number().int().nonnegative(),
  title: productTitle, description: productDescription, amount: productAmount, bytes: z.number().int().min(1).max(productFileMaxBytes),
  sha256: z.string().regex(/^[0-9a-f]{64}$/), createdAt: z.iso.datetime({ offset: true }) });
export const productVersions = z.array(productVersion).max(100);
export type ProductVersion = z.infer<typeof productVersion>;
