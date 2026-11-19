import "server-only";
import type Stripe from "stripe";
import { z } from "zod";
import type { CreatorMerchant } from "./creator-merchant";
import { creatorCheckoutId, creatorCheckoutUrl, creatorOrder, type CreatorOrder } from "./creator-orders";
import { assertCreatorReturnSite, creatorSandboxConfig, readCreatorSandboxAccount } from "./creator-stripe";

export function creatorCheckoutConfig() {
  const seller=creatorSandboxConfig();
  const secret=process.env.STRIPE_CREATOR_SANDBOX_WEBHOOK_SECRET;
  return seller&&process.env.SNOOZER_CREATOR_CHECKOUT_ENABLED==="true"&&secret&&/^whsec_[A-Za-z0-9_]{20,512}$/.test(secret)
    ? {...seller,webhookSecret:secret}:null;
}

export async function createCreatorSandboxCheckout(stripe:Stripe, value:CreatorOrder, merchant:CreatorMerchant, site:URL, now=Date.now()) {
  const order=creatorOrder.parse(value);
  const config=creatorCheckoutConfig();
  if(!config||config.platformId!==order.platformId) throw new Error("Creator Checkout is disabled.");
  const created=Date.parse(order.createdAt);
  if(order.state!=="pending"||order.checkoutId||order.holds.length||created>now+5000||created<now-23*3600000
    ||order.platformId!==merchant.platformId||order.accountId!==merchant.accountId) throw new Error("Checkout attempt unavailable.");
  assertCreatorReturnSite(site);
  if(!(await readCreatorSandboxAccount(stripe,merchant)).ready) throw new Error("Seller capabilities are not active.");
  const metadata={snoozer_order:order.id,snoozer_version:order.versionId};
  // Keep retries identical while allowing a minute for provider clock differences.
  const expires=Math.floor(created/1000)+86340;
  const result=await stripe.checkout.sessions.create({mode:"payment",client_reference_id:order.id,metadata,
    line_items:[{quantity:1,price_data:{currency:"gbp",unit_amount:order.amount,
      product_data:{name:order.title,...(order.description?{description:order.description}:{}),metadata:{snoozer_version:order.versionId}}}}],
    payment_intent_data:{metadata},adaptive_pricing:{enabled:false},expires_at:expires,
    integration_identifier:"snoozer-creator-"+order.id.slice(0,8).split("").map(x=>String.fromCharCode(97+parseInt(x,16))).join(""),
    success_url:new URL("/studio/purchases?order="+order.id,site).href,cancel_url:new URL("/studio/purchases?order="+order.id+"&cancelled=1",site).href,
  },{stripeAccount:order.accountId,idempotencyKey:"snoozer-creator-checkout-"+order.id});
  const session=z.object({id:creatorCheckoutId,object:z.literal("checkout.session"),livemode:z.literal(false),mode:z.literal("payment"),
    status:z.literal("open"),payment_status:z.literal("unpaid"),currency:z.literal("gbp"),amount_subtotal:z.literal(order.amount),amount_total:z.literal(order.amount),
    client_reference_id:z.literal(order.id),metadata:z.object({snoozer_order:z.literal(order.id),snoozer_version:z.literal(order.versionId)}),
    expires_at:z.literal(expires),url:z.string().url()}).parse(result);
  return {id:session.id,url:creatorCheckoutUrl(session.url),expiresAt:new Date(session.expires_at*1000).toISOString()};
}
