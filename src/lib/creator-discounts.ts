import { z } from "zod";
import { productAmount, productTitle } from "./products";

export const discountCode = z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9-]{2,23}$/).transform(value=>value.toUpperCase());
export const optionalDiscountCode=z.union([z.literal("").transform(()=>null),discountCode]);
const integerText=(min:number,max:number)=>z.string().regex(/^[1-9][0-9]*$/).transform(Number).pipe(z.number().int().min(min).max(max));
export const createDiscountInput=z.object({profile:z.uuid(),version:z.uuid(),code:discountCode,
  percent:integerText(1,90),uses:integerText(1,50),days:integerText(1,30)});
export const sellerDiscounts=z.object({versions:z.array(z.object({id:z.uuid(),title:productTitle,revision:z.number().int().nonnegative(),amount:productAmount})),
  codes:z.array(z.object({id:z.uuid(),versionId:z.uuid(),title:productTitle,code:z.string().regex(/^[A-Z0-9][A-Z0-9-]{2,23}$/),
    percentOff:z.number().int().min(1).max(90),maxUses:z.number().int().min(1).max(50),used:z.number().int().nonnegative(),
    expiresAt:z.iso.datetime({offset:true}),disabled:z.boolean()}).refine(v=>v.used<=v.maxUses)).max(50)});
