import "server-only";

import Stripe from "stripe";
import { z } from "zod";
import { premiumLiveReadConfig, premiumLiveWebhookConfig } from "./premium-live-config";
import { verifiedLiveStripeUrl } from "./premium-live-proof";
import { siteUrl } from "./env";
import { storageAdmin } from "./supabase";

const priceId=z.string().regex(/^price_[A-Za-z0-9]{1,128}$/);
const productId=z.string().regex(/^prod_[A-Za-z0-9]{1,128}$/);
const sessionId=z.string().regex(/^cs_live_[A-Za-z0-9]{1,128}$/);
const offerSchema=z.object({
  price_id:priceId,
  product_id:productId,
  currency:z.literal("eur"),
  unit_amount:z.literal(499),
  automatic_tax_enabled:z.boolean(),
});
const attemptSchema=z.object({
  id:z.uuid(),
  priceId,
  productId,
  currency:z.literal("eur"),
  amount:z.literal(499),
  sessionId:sessionId.nullable(),
  expires:z.number().int().positive(),
});

function imageHostCheckoutConfig(){
  const stripe=premiumLiveReadConfig();
  const webhook=premiumLiveWebhookConfig();
  if(!stripe||!webhook
    ||process.env.SNOOZER_IMAGE_HOST_LIVE_ENABLED!=="true"
    ||process.env.SNOOZER_IMAGE_HOST_LEGAL_CONFIRMED!=="true")return null;
  return stripe;
}

export async function imageHostLiveOffers(){
  if(!imageHostCheckoutConfig())return [];
  const {data,error}=await storageAdmin().rpc("list_image_host_addon_offers");
  if(error||!data)return [];
  const parsed=z.array(offerSchema).max(1).safeParse(data);
  return parsed.success?parsed.data:[];
}

export async function openImageHostLifetimeCheckout(ownerId:string,email:string|null,rawPrice:string){
  const config=imageHostCheckoutConfig();
  if(!config)throw new Error("Image Host lifetime Checkout is not enabled.");
  const selectedPrice=priceId.parse(rawPrice);
  const admin=storageAdmin();
  const offers=await imageHostLiveOffers();
  const offer=offers.find(item=>item.price_id===selectedPrice);
  if(!offer)throw new Error("The Image Host lifetime offer is not approved.");

  const stripe=new Stripe(config.key,{timeout:8000,maxNetworkRetries:1});
  const account=await stripe.accounts.retrieve(config.accountId);
  if(account.id!==config.accountId||!account.charges_enabled||!account.details_submitted)
    throw new Error("The Snoozer live Stripe account is not ready.");

  const prepared=await admin.rpc("prepare_image_host_checkout",{p_owner:ownerId,p_price:offer.price_id});
  if(prepared.error||!prepared.data)throw new Error("Image Host checkout is unavailable or access is already active.");
  const attempt=attemptSchema.parse(prepared.data);
  if(attempt.priceId!==offer.price_id||attempt.productId!==offer.product_id
    ||attempt.currency!==offer.currency||attempt.amount!==offer.unit_amount)
    throw new Error("The Image Host lifetime offer changed.");

  const price=await stripe.prices.retrieve(attempt.priceId);
  const actualProduct=typeof price.product==="string"?price.product:price.product.id;
  if(!price.livemode||!price.active||price.type!=="one_time"
    ||price.currency!=="eur"||price.unit_amount!==499
    ||!price.tax_behavior||price.tax_behavior==="unspecified"||actualProduct!==attempt.productId)
    throw new Error("Stripe Price does not match the approved EUR 4.99 one-time product or reviewed tax behaviour.");
  const product=await stripe.products.retrieve(attempt.productId);
  if(!product.livemode||!product.active||product.metadata.snoozer_image_host!=="true")
    throw new Error("Stripe Product is not marked as the approved Snoozer Image Host product.");

  const metadata={snoozer_image_host_purchase:attempt.id,snoozer_image_host_owner:ownerId};
  let session:Stripe.Checkout.Session;
  if(attempt.sessionId){
    session=await stripe.checkout.sessions.retrieve(attempt.sessionId);
  }else{
    const returnTo=new URL("/studio/image-host",siteUrl());
    session=await stripe.checkout.sessions.create({
      mode:"payment",
      client_reference_id:ownerId,
      ...(email?{customer_email:email}:{}),
      customer_creation:"always",
      line_items:[{price:attempt.priceId,quantity:1}],
      billing_address_collection:"required",
      ...(offer.automatic_tax_enabled?{automatic_tax:{enabled:true}}:{}),
      success_url:new URL("?purchase=processing",returnTo).href,
      cancel_url:new URL("?purchase=cancelled",returnTo).href,
      expires_at:attempt.expires,
      metadata,
      payment_intent_data:{metadata},
    },{idempotencyKey:"snoozer-image-host-lifetime-"+attempt.id});
  }

  const checked=z.object({
    id:sessionId,
    livemode:z.literal(true),
    mode:z.literal("payment"),
    client_reference_id:z.literal(ownerId),
    status:z.enum(["open","complete","expired"]),
    payment_status:z.enum(["paid","unpaid","no_payment_required"]),
    url:z.string().nullable(),
    metadata:z.object({
      snoozer_image_host_purchase:z.literal(attempt.id),
      snoozer_image_host_owner:z.literal(ownerId),
    }),
  }).parse(session);
  if(checked.id!==attempt.sessionId&&attempt.sessionId!==null)
    throw new Error("Image Host Checkout session identity mismatch.");
  if(checked.status!=="open"||!checked.url)
    throw new Error("Image Host Checkout is not open.");
  const bound=await admin.rpc("bind_image_host_session",{
    p_owner:ownerId,p_attempt:attempt.id,p_session:checked.id,
  });
  if(bound.error||bound.data!==true)
    throw new Error("Image Host Checkout session could not be safely bound.");
  return verifiedLiveStripeUrl(checked.url,"checkout.stripe.com");
}

export async function completeImageHostLifetimePurchase(stripe:Stripe,rawSessionId:string){
  const id=sessionId.parse(rawSessionId);
  const admin=storageAdmin();
  const session=await stripe.checkout.sessions.retrieve(id);
  const metadata=z.object({
    snoozer_image_host_purchase:z.uuid(),
    snoozer_image_host_owner:z.uuid(),
  }).safeParse(session.metadata);
  if(!metadata.success)return false;
  const {snoozer_image_host_purchase:attempt,snoozer_image_host_owner:owner}=metadata.data;
  const paymentIntent=typeof session.payment_intent==="string"
    ?session.payment_intent:session.payment_intent?.id;
  if(!paymentIntent)return false;
  const pi=await stripe.paymentIntents.retrieve(paymentIntent);
  const lineItems=await stripe.checkout.sessions.listLineItems(id,{limit:2});
  if(!session.livemode||session.id!==id||session.mode!=="payment"
    ||session.status!=="complete"||session.payment_status!=="paid"
    ||session.client_reference_id!==owner||session.currency!=="eur"
    ||session.amount_total!==499||!pi.livemode||pi.status!=="succeeded"
    ||pi.currency!=="eur"||pi.amount!==499||pi.metadata.snoozer_image_host_purchase!==attempt
    ||pi.metadata.snoozer_image_host_owner!==owner
    ||lineItems.data.length!==1||lineItems.has_more
    ||lineItems.data[0].quantity!==1||lineItems.data[0].amount_total!==499
    ||lineItems.data[0].currency!=="eur")throw new Error("Image Host payment proof is incomplete.");
  const linePrice=lineItems.data[0].price;
  const linePriceId=typeof linePrice==="string"?linePrice:linePrice?.id;
  if(!linePriceId)throw new Error("Image Host Price identity is missing.");
  const price=await stripe.prices.retrieve(linePriceId);
  const productId=typeof price.product==="string"?price.product:price.product.id;
  const product=await stripe.products.retrieve(productId);
  const sessionCustomer=typeof session.customer==="string"?session.customer:session.customer?.id;
  const paymentCustomer=typeof pi.customer==="string"?pi.customer:pi.customer?.id;
  if(!price.livemode||price.type!=="one_time"
    ||price.currency!=="eur"||price.unit_amount!==499
    ||!price.tax_behavior||price.tax_behavior==="unspecified"
    ||!product.livemode||product.metadata.snoozer_image_host!=="true"
    ||!sessionCustomer||paymentCustomer!==sessionCustomer)
    throw new Error("Image Host Stripe Price, Product and payment ownership proof does not match.");
  const completed=await admin.rpc("complete_image_host_purchase",{
    p_owner:owner,p_attempt:attempt,p_session:id,p_payment_intent:paymentIntent,
    p_price:linePriceId,p_currency:"eur",p_amount:499,p_paid:true,
  });
  if(completed.error||completed.data!==true)throw new Error("Image Host lifetime access could not be recorded.");
  return true;
}

export async function expireImageHostCheckout(stripe:Stripe,rawSessionId:string){
  const id=sessionId.parse(rawSessionId);
  const session=await stripe.checkout.sessions.retrieve(id);
  const metadata=z.object({
    snoozer_image_host_purchase:z.uuid(),
    snoozer_image_host_owner:z.uuid(),
  }).safeParse(session.metadata);
  if(!metadata.success)return false;
  if(!session.livemode||session.status!=="expired"||session.mode!=="payment"
    ||session.id!==id||session.client_reference_id!==metadata.data.snoozer_image_host_owner)
    throw new Error("Image Host Checkout expiry could not be verified.");
  const result=await storageAdmin().rpc("expire_image_host_checkout",{
    p_owner:metadata.data.snoozer_image_host_owner,
    p_attempt:metadata.data.snoozer_image_host_purchase,
    p_session:id,
  });
  if(result.error)throw new Error("Image Host Checkout expiry could not be saved.");
  return result.data===true;
}

export async function holdImageHostLifetimePayment(stripe:Stripe,event:Stripe.Event){
  let paymentIntent:string|null=null;
  let reason:"refund"|"dispute"|"fraud";
  if(event.type==="charge.refunded"){
    // The signed Charge event includes the refund state and PaymentIntent.
    // Do not perform an unnecessary second Stripe request.
    const charge=event.data.object as Stripe.Charge;
    if(!charge.livemode||charge.amount_refunded<=0)return false;
    paymentIntent=typeof charge.payment_intent==="string"?charge.payment_intent:charge.payment_intent?.id??null;
    reason="refund";
  }else if(event.type.startsWith("charge.dispute.")){
    if(typeof stripe.disputes?.retrieve!=="function"||typeof stripe.charges?.retrieve!=="function")return false;
    const disputeId=(event.data.object as Stripe.Dispute).id;
    const dispute=await stripe.disputes.retrieve(disputeId);
    if(!dispute.livemode||dispute.id!==disputeId)return false;
    const chargeId=typeof dispute.charge==="string"?dispute.charge:dispute.charge?.id;
    if(!chargeId)return false;
    const charge=await stripe.charges.retrieve(chargeId);
    if(!charge.livemode)return false;
    paymentIntent=typeof charge.payment_intent==="string"?charge.payment_intent:charge.payment_intent?.id??null;
    reason="dispute";
  }else if(event.type==="radar.early_fraud_warning.created"){
    if(typeof stripe.radar?.earlyFraudWarnings?.retrieve!=="function"||typeof stripe.charges?.retrieve!=="function")return false;
    const warningId=(event.data.object as Stripe.Radar.EarlyFraudWarning).id;
    const warning=await stripe.radar.earlyFraudWarnings.retrieve(warningId);
    if(!warning.livemode||warning.id!==warningId)return false;
    const chargeId=typeof warning.charge==="string"?warning.charge:warning.charge?.id;
    if(!chargeId)return false;
    const charge=await stripe.charges.retrieve(chargeId);
    if(!charge.livemode)return false;
    paymentIntent=typeof charge.payment_intent==="string"?charge.payment_intent:charge.payment_intent?.id??null;
    reason="fraud";
  }else return false;
  if(!paymentIntent)return false;
  const result=await storageAdmin().rpc("hold_image_host_payment",{
    p_event:event.id,p_payment_intent:paymentIntent,p_reason:reason,
  });
  if(result.error)throw new Error("Image Host payment risk hold could not be recorded.");
  return result.data===true;
}
