import { z } from "zod";
import { productAmount,productTitle } from "./products";

export const creatorPurchases=z.array(z.object({id:z.uuid(),versionId:z.uuid(),title:productTitle,amount:productAmount,currency:z.literal("gbp"),
  state:z.enum(["pending","paid","expired"]),held:z.boolean(),accessActive:z.boolean(),accessUntil:z.iso.datetime({offset:true}).nullable(),createdAt:z.iso.datetime({offset:true}),
  // Optional for rolling deployment with the prior SQL projection.
  originalAmount:productAmount.optional(),paidAt:z.iso.datetime({offset:true}).nullable().optional(),
  holds:z.array(z.enum(["refund","dispute","fraud"])).max(3).optional(),
}).refine(v=>(v.originalAmount===undefined||v.originalAmount>=v.amount)
  &&(v.holds===undefined||(new Set(v.holds).size===v.holds.length&&v.held===(v.holds.length>0))))).max(64);

export function purchaseHoldLabels(holds:("refund"|"dispute"|"fraud")[]|undefined) {
  const labels={refund:"Refund-related hold",dispute:"Dispute-related hold",fraud:"Payment risk review hold"};
  return (holds??[]).map(hold=>labels[hold]);
}
