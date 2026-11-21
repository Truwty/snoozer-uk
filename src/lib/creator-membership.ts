import {z} from "zod";
import {productTitle} from "./products";
export const membershipBenefits=z.string().max(500).refine(s=>!/[\u0000-\u0008\u000b-\u001f\u007f]/.test(s));
const fields=z.object({id:z.uuid(),title:productTitle,benefits:membershipBenefits,monthlyPence:z.number().int().min(100).max(10000)});
export const publicMembershipOffers=z.array(fields.refine(v=>v.benefits.trim().length>0)).max(5);
export const ownerMembershipOffers=z.array(fields.extend({revision:z.number().int().nonnegative(),visible:z.boolean()}).refine(v=>!v.visible||v.benefits.trim().length>0)).max(5);
export type OwnerMembershipOffer=z.infer<typeof ownerMembershipOffers>[number];
export const membershipPrice=z.string().regex(/^(?:[1-9]\d{0,2})(?:\.\d{1,2})?$/).transform(s=>Math.round(Number(s)*100)).pipe(z.number().int().min(100).max(10000));
