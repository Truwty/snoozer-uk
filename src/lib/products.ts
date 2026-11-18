import { z } from "zod";

export const productTitle = z.string().trim().min(1).max(100).refine((value) => !/[\u0000-\u001f\u007f]/.test(value));
export const productDescription = z.string().max(2000).refine((value) => !/[\u0000-\u0008\u000b-\u001f\u007f]/.test(value));
export const productAmount = z.number().int().min(50).max(100000);
export const productPrice = z.string().regex(/^(0|[1-9]\d{0,3})(\.\d{1,2})?$/)
  .transform((value) => { const [pounds, pence = ""] = value.split("."); return Number(pounds) * 100 + Number(pence.padEnd(2, "0")); }).pipe(productAmount);
export function priceInput(amount: number) { return (amount / 100).toFixed(2); }
export const productDraft = z.object({ id: z.uuid(), revision: z.number().int().nonnegative(), title: productTitle,
  description: productDescription, amount: productAmount, archived: z.boolean(), updatedAt: z.iso.datetime({ offset: true }) });
export const productInventory = z.object({ activeLimit: z.literal(5), totalLimit: z.literal(20), activeUsed: z.number().int().min(0).max(5),
  totalUsed: z.number().int().min(0).max(20), items: z.array(productDraft).max(20) });
export type ProductDraft = z.infer<typeof productDraft>;
