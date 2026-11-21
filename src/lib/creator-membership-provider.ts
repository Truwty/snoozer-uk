import "server-only";
import type Stripe from "stripe";
import {z} from "zod";
import {creatorCheckoutId,creatorCheckoutUrl} from "./creator-orders";
import {memberSubscriptionId,memberCustomerId,memberRecord,type MemberRecord,type MemberHold} from "./creator-membership-subscription";
import {assertCreatorReturnSite,creatorSandboxConfig,readCreatorSandboxAccount} from "./creator-stripe";
import type {CreatorMerchant} from "./creator-merchant";

const stripeId=(prefix:string)=>z.string().regex(new RegExp("^"+prefix+"[A-Za-z0-9]{1,128}$"));
const dateSeconds=z.number().int().positive().max(253402300799);
const date=(n:number)=>new Date(n*1000).toISOString();
export function membershipConfig() {
 const config=creatorSandboxConfig(),secret=process.env.STRIPE_CREATOR_MEMBERSHIP_WEBHOOK_SECRET;
 return config&&secret&&/^whsec_[A-Za-z0-9_]{20,512}$/.test(secret)?{...config,secret}:null;
}
export function membershipCheckoutConfig() {
 const config=membershipConfig();
 return config&&process.env.SNOOZER_CREATOR_MEMBERSHIP_CHECKOUT_ENABLED==="true"&&process.env.SNOOZER_CREATOR_CHECKOUT_ENABLED==="true"?config:null;
}
const metadata=(m:MemberRecord)=>({snoozer_membership:m.id,snoozer_membership_offer:m.offerId});
const metadataSchema=(m:MemberRecord)=>z.object({snoozer_membership:z.literal(m.id),snoozer_membership_offer:z.literal(m.offerId)});
const price=(m:MemberRecord)=>z.object({id:stripeId("price_"),currency:z.literal("gbp"),unit_amount:z.literal(m.monthlyPence),
 type:z.literal("recurring"),recurring:z.object({interval:z.literal("month"),interval_count:z.literal(1),usage_type:z.literal("licensed")})});
export function inspectMembershipCheckout(value:unknown,record:MemberRecord) {
 const m=memberRecord.parse(record);
 const s=z.object({id:creatorCheckoutId,object:z.literal("checkout.session"),livemode:z.literal(false),mode:z.literal("subscription"),
 status:z.enum(["open","complete","expired"]),currency:z.literal("gbp"),amount_total:z.literal(m.monthlyPence),amount_subtotal:z.literal(m.monthlyPence),
 client_reference_id:z.literal(m.id),metadata:metadataSchema(m),created:dateSeconds,expires_at:dateSeconds,
 subscription:memberSubscriptionId.nullable(),customer:memberCustomerId.nullable(),
 total_details:z.object({amount_discount:z.literal(0),amount_shipping:z.literal(0),amount_tax:z.literal(0)}),
 url:z.string().nullable()}).parse(value);
 const created=Date.parse(m.createdAt);
 if((m.checkoutId&&s.id!==m.checkoutId)||s.created*1000<created-5000||s.created*1000>created+23*3600000
 ||s.expires_at*1000>created+86400000||s.expires_at<=s.created
 ||(m.subscriptionId&&s.subscription!==m.subscriptionId)||(m.customerId&&s.customer!==m.customerId)
 ||(s.status==="complete"&&(!s.subscription||!s.customer))) throw new Error("Membership Checkout binding mismatch.");
 return {id:s.id,status:s.status,subscriptionId:s.subscription,customerId:s.customer,url:s.status==="open"?creatorCheckoutUrl(s.url):null};
}
export async function openMembershipCheckout(stripe:Stripe,m:MemberRecord,merchant:CreatorMerchant,site:URL) {
 const config=membershipCheckoutConfig();
 if(!config||config.platformId!==m.platformId||merchant.platformId!==m.platformId||merchant.accountId!==m.accountId||m.state!=="pending"||m.subscriptionId)
  throw new Error("Membership Checkout disabled.");
 assertCreatorReturnSite(site);
 if(!(await readCreatorSandboxAccount(stripe,merchant)).ready) throw new Error("Seller unavailable.");
 const scope={stripeAccount:m.accountId};
 if(m.checkoutId) return inspectMembershipCheckout(await stripe.checkout.sessions.retrieve(m.checkoutId,{},scope),m);
 const created=Date.parse(m.createdAt),now=Date.now();
 if(created>now+5000||created<now-23*3600000) throw new Error("Uncertain Checkout requires operator reconciliation.");
 const tags=metadata(m);
 const session=await stripe.checkout.sessions.create({mode:"subscription",client_reference_id:m.id,metadata:tags,
 line_items:[{quantity:1,price_data:{currency:"gbp",unit_amount:m.monthlyPence,recurring:{interval:"month"},product_data:{name:m.title}}}],
 subscription_data:{metadata:tags},adaptive_pricing:{enabled:false},expires_at:Math.floor(created/1000)+86340,
 integration_identifier:"snoozer-membership-"+m.id.slice(0,8).split("").map(x=>String.fromCharCode(97+parseInt(x,16))).join(""),
 success_url:new URL("/studio/memberships",site).href,cancel_url:new URL("/studio/memberships",site).href},
 {...scope,idempotencyKey:"snoozer-membership-checkout-"+m.id});
 const result=inspectMembershipCheckout(session,m);
 if(result.status!=="open"||!result.url) throw new Error("Checkout unavailable.");
 return result;
}
export function inspectMembershipSubscription(value:unknown,m:MemberRecord,now=Date.now()) {
 const sub=z.object({id:memberSubscriptionId,object:z.literal("subscription"),livemode:z.literal(false),customer:memberCustomerId,
 status:z.enum(["active","canceled","incomplete","incomplete_expired","past_due","paused","trialing","unpaid"]),
 metadata:metadataSchema(m),cancel_at_period_end:z.boolean(),collection_method:z.literal("charge_automatically"),
 latest_invoice:stripeId("in_").nullable(),application_fee_percent:z.null(),transfer_data:z.null(),on_behalf_of:z.null(),
 pause_collection:z.unknown().nullable(),
 items:z.object({has_more:z.literal(false),data:z.array(z.object({id:stripeId("si_"),quantity:z.literal(1),price:price(m),
 current_period_start:dateSeconds,current_period_end:dateSeconds})).length(1)})}).parse(value);
 if(sub.id!==m.subscriptionId||sub.customer!==m.customerId) throw new Error("Membership subscription mismatch.");
 const item=sub.items.data[0];
 if(item.current_period_end<=item.current_period_start||item.current_period_end-item.current_period_start>32*86400) throw new Error("Invalid membership period.");
 const eligible=sub.status==="active"&&sub.pause_collection===null&&item.current_period_start*1000<=now&&item.current_period_end*1000>now;
 return {state:eligible?"active" as const:sub.status==="canceled"||sub.status==="incomplete_expired"?"cancelled" as const:"inactive" as const,
 periodEnd:date(item.current_period_end),cancelAtEnd:sub.cancel_at_period_end,invoiceId:sub.latest_invoice,itemId:item.id,start:item.current_period_start,end:item.current_period_end};
}
export const invoiceSubscription=z.object({object:z.literal("invoice"),livemode:z.literal(false),parent:z.object({type:z.literal("subscription_details"),subscription_details:z.object({subscription:memberSubscriptionId})})});
export function inspectMembershipInvoice(value:unknown,m:MemberRecord,proof:ReturnType<typeof inspectMembershipSubscription>) {
 const invoiceSchema=invoiceSubscription.extend({id:stripeId("in_"),customer:memberCustomerId,currency:z.literal("gbp"),status:z.literal("paid"),
 amount_due:z.literal(m.monthlyPence),amount_paid:z.literal(m.monthlyPence),amount_remaining:z.literal(0),total:z.literal(m.monthlyPence),
 lines:z.object({has_more:z.literal(false),data:z.array(z.object({amount:z.literal(m.monthlyPence),currency:z.literal("gbp"),
 period:z.object({start:z.literal(proof.start),end:z.literal(proof.end)}),parent:z.object({type:z.literal("subscription_item_details"),subscription_item_details:z.object({subscription_item:z.literal(proof.itemId)})})})).length(1)})});
 const invoice=invoiceSchema.parse(value);
 if(invoice.id!==proof.invoiceId||invoice.customer!==m.customerId||invoice.parent.subscription_details.subscription!==m.subscriptionId) throw new Error("Membership invoice binding mismatch.");
 return invoice.id;
}
export async function readMembershipProof(stripe:Stripe,m:MemberRecord) {
 if(!m.subscriptionId) throw new Error("Subscription is not bound.");
 const scope={stripeAccount:m.accountId},checkedAt=new Date().toISOString();
 const proof=inspectMembershipSubscription(await stripe.subscriptions.retrieve(m.subscriptionId,{},scope),m);
 const holds:MemberHold[]=[];
 if(proof.state!=="active") return {...proof,checkedAt,holds};
 if(!proof.invoiceId) throw new Error("Active subscription lacks invoice.");
 const invoice=inspectMembershipInvoice(await stripe.invoices.retrieve(proof.invoiceId,{},scope),m,proof);
 const payments=z.object({has_more:z.literal(false),data:z.array(z.object({object:z.literal("invoice_payment"),livemode:z.literal(false),invoice:z.literal(invoice),
 status:z.literal("paid"),amount_paid:z.literal(m.monthlyPence),currency:z.literal("gbp"),
 payment:z.object({type:z.literal("payment_intent"),payment_intent:stripeId("pi_")})})).length(1)})
 .parse(await stripe.invoicePayments.list({invoice,status:"paid",limit:2},scope));
 const paymentId=payments.data[0].payment.payment_intent;
 const pi=z.object({id:z.literal(paymentId),object:z.literal("payment_intent"),livemode:z.literal(false),customer:z.literal(m.customerId),
 currency:z.literal("gbp"),amount:z.literal(m.monthlyPence),amount_received:z.literal(m.monthlyPence),status:z.literal("succeeded"),
 application_fee_amount:z.null(),transfer_data:z.null(),on_behalf_of:z.null(),latest_charge:stripeId("ch_")})
 .parse(await stripe.paymentIntents.retrieve(paymentId,{},scope));
 const charge=z.object({id:z.literal(pi.latest_charge),object:z.literal("charge"),livemode:z.literal(false),payment_intent:z.literal(paymentId),
 amount:z.literal(m.monthlyPence),currency:z.literal("gbp"),paid:z.literal(true),captured:z.literal(true),status:z.literal("succeeded"),
 amount_refunded:z.number().int().min(0).max(m.monthlyPence),refunded:z.boolean(),disputed:z.boolean(),
 fraud_details:z.object({user_report:z.string().optional(),stripe_report:z.string().optional()}).nullable(),
 outcome:z.object({risk_level:z.string().optional()}).nullable()}).parse(await stripe.charges.retrieve(pi.latest_charge,{},scope));
 const [disputes,warnings]=await Promise.all([stripe.disputes.list({charge:charge.id,limit:1},scope),stripe.radar.earlyFraudWarnings.list({charge:charge.id,limit:1},scope)]);
 const risks=(kind:string)=>z.object({has_more:z.boolean(),data:z.array(z.object({object:z.literal(kind),livemode:z.literal(false),charge:z.literal(charge.id)})).max(1)})
 .refine(v=>!v.has_more||v.data.length>0);
 if(charge.refunded||charge.amount_refunded>0) holds.push("refund");
 if(charge.disputed||risks("dispute").parse(disputes).data.length) holds.push("dispute");
 if(charge.fraud_details?.user_report==="fraudulent"||charge.fraud_details?.stripe_report==="fraudulent"||charge.outcome?.risk_level==="highest"
 ||risks("radar.early_fraud_warning").parse(warnings).data.length) holds.push("fraud");
 return {...proof,checkedAt,holds};
}
