import { z } from "zod";
import { productDraft } from "./products";

export const collectionTitle = z.string().trim().min(1).max(80)
  .refine(v=>!/[\u0000-\u001f\u007f]/.test(v));
export const collectionDescription = z.string().max(500)
  .refine(v=>!/[\u0000-\u0008\u000b-\u001f\u007f]/.test(v));
export const creatorCollection = z.object({
  id:z.uuid(), revision:z.number().int().nonnegative(),
  title:collectionTitle,description:collectionDescription,visible:z.boolean(),
  productIds:z.array(z.uuid()).max(5).refine(ids=>new Set(ids).size===ids.length),
});
export const creatorCollections = z.array(creatorCollection).max(5);
export type CreatorCollection = z.infer<typeof creatorCollection>;

export const publicCreatorCollections = z.array(z.object({
  id:z.uuid(), title:collectionTitle, description:collectionDescription,
  versionIds:z.array(z.uuid()).min(1).max(5),
})).max(5);

export function collectionAvailableDrafts(items: unknown) {
  return z.array(productDraft).max(20).parse(items);
}
