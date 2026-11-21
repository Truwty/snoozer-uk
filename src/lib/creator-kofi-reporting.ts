import {z} from "zod";
export const creatorKofiToken=z.string().trim().min(16).max(128).regex(/^[A-Za-z0-9_-]+$/);
export const creatorKofiReport=z.object({
 revision:z.number().int().positive().nullable(),enabled:z.boolean(),
 lastReportedAt:z.iso.datetime({offset:true}).nullable(),
 totals:z.array(z.object({currency:z.enum(["GBP","USD"]),count:z.number().int().nonnegative(),
  amountMinor:z.number().int().nonnegative()})).max(2),
 notifications:z.array(z.object({id:z.uuid(),transactionId:z.string().min(1).max(128),
  currency:z.enum(["GBP","USD"]),amountMinor:z.number().int().positive().max(99999999),
  occurredAt:z.iso.datetime({offset:true})})).max(50),
});
export function formatReportedAmount(amountMinor:number,currency:"GBP"|"USD") {
 return new Intl.NumberFormat("en-GB",{style:"currency",currency}).format(amountMinor/100);
}
