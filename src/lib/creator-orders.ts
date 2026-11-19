import { z } from "zod";
import { stripeAccountId } from "./creator-merchant";
import { productAmount, productDescription, productTitle } from "./products";
import { productFileMaxBytes } from "./product-files";

export const creatorCheckoutId = z.string().regex(/^cs_test_[A-Za-z0-9]{1,255}$/);
export const creatorOrder = z.object({ id:z.uuid(), buyerId:z.uuid(), sellerId:z.uuid(), profileId:z.uuid(), versionId:z.uuid(),
  platformId:stripeAccountId, accountId:stripeAccountId, createdAt:z.iso.datetime({offset:true}),
  checkoutId:creatorCheckoutId.nullable(), checkoutExpiresAt:z.iso.datetime({offset:true}).nullable(),
  paymentId:z.string().regex(/^pi_[A-Za-z0-9]{1,128}$/).nullable(), chargeId:z.string().regex(/^ch_[A-Za-z0-9]{1,128}$/).nullable(),
  state:z.enum(["pending","paid","expired"]), paidAt:z.iso.datetime({offset:true}).nullable(), accessUntil:z.iso.datetime({offset:true}).nullable(),
  holds:z.array(z.enum(["refund","dispute","fraud"])).max(3), title:productTitle, description:productDescription, amount:productAmount,
  currency:z.literal("gbp"), bytes:z.number().int().min(1).max(productFileMaxBytes), sha256:z.string().regex(/^[0-9a-f]{64}$/),
}).refine(v=>v.buyerId!==v.sellerId&&v.accountId!==v.platformId&&(v.checkoutId===null)===(v.checkoutExpiresAt===null)
  &&new Set(v.holds).size===v.holds.length&&(v.paidAt===null)===(v.accessUntil===null)
  &&(v.state!=="paid"||!!(v.checkoutId&&v.paymentId&&v.chargeId&&v.paidAt&&v.accessUntil)));
export type CreatorOrder = z.infer<typeof creatorOrder>;

export function creatorCheckoutUrl(value:unknown) {
  const target=new URL(z.string().url().parse(value));
  if(target.origin!=="https://checkout.stripe.com"||target.username||target.password) throw new Error("Unexpected Checkout origin.");
  return target.href;
}
