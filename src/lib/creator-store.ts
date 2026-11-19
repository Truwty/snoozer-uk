import { z } from "zod";
import { username } from "./profile";
import { productAmount,productDescription,productTitle } from "./products";
import { productFileMaxBytes } from "./product-files";

export const creatorOffers=z.array(z.object({versionId:z.uuid(),enabled:z.boolean(),reviewExpiresAt:z.iso.datetime({offset:true})})).max(20);
export type CreatorOffer=z.infer<typeof creatorOffers>[number];
export const creatorStore=z.object({username,displayName:z.string().max(60),items:z.array(z.object({versionId:z.uuid(),title:productTitle,description:productDescription,
  amount:productAmount,currency:z.literal("gbp"),bytes:z.number().int().min(1).max(productFileMaxBytes)})).max(5)});
