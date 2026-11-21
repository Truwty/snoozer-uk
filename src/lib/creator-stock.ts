import {z} from "zod";
export const sellerStock=z.array(z.object({
  versionId:z.uuid(),title:z.string().min(1).max(100),revision:z.number().int().nonnegative(),
  totalSlots:z.number().int().min(1).max(50).nullable(),
  reserved:z.number().int().nonnegative().max(50),
}).refine(s=>s.totalSlots===null?s.reserved===0:s.reserved<=s.totalSlots)).max(100);
export const publicStock=z.array(z.object({
  versionId:z.uuid(),remaining:z.number().int().min(0).max(50),
})).max(5);
export function stockState(stock:{totalSlots:number|null,reserved:number}) {
  return stock.totalSlots===null?"Unlimited":`${stock.totalSlots-stock.reserved} of ${stock.totalSlots} unreserved slots`;
}
