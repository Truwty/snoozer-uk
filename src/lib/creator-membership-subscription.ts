import {z} from "zod";
import {stripeAccountId} from "./creator-merchant";
import {creatorCheckoutId} from "./creator-orders";
import {productTitle} from "./products";
export const memberSubscriptionId=z.string().regex(/^sub_[A-Za-z0-9]{1,128}$/);
export const memberCustomerId=z.string().regex(/^cus_[A-Za-z0-9]{1,128}$/);
export const memberHold=z.enum(["refund","dispute","fraud"]);
export const memberState=z.enum(["pending","active","inactive","cancelled"]);
const date=z.iso.datetime({offset:true});
export const memberRecord=z.object({id:z.uuid(),buyerId:z.uuid(),sellerId:z.uuid(),offerId:z.uuid(),offerRevision:z.number().int().nonnegative(),
 title:productTitle,benefits:z.string().max(500),monthlyPence:z.number().int().min(100).max(10000),platformId:stripeAccountId,accountId:stripeAccountId,
 createdAt:date,checkoutId:creatorCheckoutId.nullable(),subscriptionId:memberSubscriptionId.nullable(),customerId:memberCustomerId.nullable(),
 state:memberState,periodEnd:date.nullable(),checkedAt:date.nullable(),cancelAtEnd:z.boolean(),holds:z.array(memberHold).max(3),pendingReceipt:z.boolean()
}).refine(v=>v.buyerId!==v.sellerId&&v.accountId!==v.platformId&&(v.subscriptionId===null)===(v.customerId===null)&&
 (v.state!=="active"||!!(v.subscriptionId&&v.checkoutId&&v.periodEnd&&v.checkedAt))&&new Set(v.holds).size===v.holds.length);
export type MemberRecord=z.infer<typeof memberRecord>;
export type MemberHold=z.infer<typeof memberHold>;
export const memberHistory=z.array(z.object({id:z.uuid(),title:productTitle,monthlyPence:z.number().int().min(100).max(10000),state:memberState,
 periodEnd:date.nullable(),cancelAtEnd:z.boolean(),held:z.boolean(),pendingReceipt:z.boolean()})).max(10);
export function membershipAccess(record:MemberRecord,now=Date.now()) {
 return record.state==="active"&&!record.pendingReceipt&&!record.holds.length&&!!record.periodEnd&&!!record.checkedAt
  &&Date.parse(record.periodEnd)>now&&Date.parse(record.checkedAt)<=now+5000&&Date.parse(record.checkedAt)>now-30000;
}
