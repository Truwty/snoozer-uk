import { z } from "zod";
import { productAmount,productTitle } from "./products";

export const creatorPurchases=z.array(z.object({id:z.uuid(),versionId:z.uuid(),title:productTitle,amount:productAmount,currency:z.literal("gbp"),
  state:z.enum(["pending","paid","expired"]),held:z.boolean(),accessActive:z.boolean(),accessUntil:z.iso.datetime({offset:true}).nullable(),createdAt:z.iso.datetime({offset:true}),
})).max(64);
