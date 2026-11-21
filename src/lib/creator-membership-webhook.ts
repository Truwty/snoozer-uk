import "server-only";
import Stripe from "stripe";
import {z} from "zod";
import {boundedBody} from "./bounded-request";
import {stripeAccountId} from "./creator-merchant";
import {memberSubscriptionId,type MemberRecord,type MemberHold} from "./creator-membership-subscription";
import {inspectMembershipCheckout,invoiceSubscription} from "./creator-membership-provider";
import {assertCreatorPlatform} from "./creator-stripe";
import {applyMembershipProof,bindMembership,expireMembership,findMembership,finishMembershipCheckoutEvent,getMembership,stageMembershipEvent} from "./creator-membership-server";

const kinds={
 "checkout.session.completed":["checkout.session","cs_test_"],
 "checkout.session.async_payment_succeeded":["checkout.session","cs_test_"],
 "checkout.session.async_payment_failed":["checkout.session","cs_test_"],
 "checkout.session.expired":["checkout.session","cs_test_"],
 "customer.subscription.created":["subscription","sub_"],
 "customer.subscription.updated":["subscription","sub_"],
 "customer.subscription.deleted":["subscription","sub_"],
 "customer.subscription.paused":["subscription","sub_"],
 "customer.subscription.resumed":["subscription","sub_"],
 "invoice.paid":["invoice","in_"],
 "invoice.payment_failed":["invoice","in_"],
 "invoice.payment_action_required":["invoice","in_"],
 "invoice.finalization_failed":["invoice","in_"],
 "invoice.voided":["invoice","in_"],
 "invoice.marked_uncollectible":["invoice","in_"],
 "charge.refunded":["charge","ch_"],
 "charge.dispute.created":["dispute","du_"],
 "charge.dispute.updated":["dispute","du_"],
 "charge.dispute.closed":["dispute","du_"],
 "radar.early_fraud_warning.created":["radar.early_fraud_warning","issfr_"],
 "radar.early_fraud_warning.updated":["radar.early_fraud_warning","issfr_"],
} as const;
const schema=z.object({object:z.literal("event"),id:z.string().regex(/^evt_[A-Za-z0-9]{1,128}$/),
 account:stripeAccountId,context:stripeAccountId.nullable().optional(),livemode:z.literal(false),type:z.string(),
 data:z.object({object:z.object({id:z.string(),object:z.string(),livemode:z.literal(false)})})})
 .refine(v=>v.context==null||v.context===v.account);
export function parseMembershipEvent(value:unknown) {
 const event=schema.parse(value);
 if(!Object.hasOwn(kinds,event.type)) return null;
 const [object,prefix]=kinds[event.type as keyof typeof kinds],id=event.data.object.id;
 if(event.data.object.object!==object||!id.startsWith(prefix)||!/^[A-Za-z0-9]+$/.test(id.slice(prefix.length))||id.length>263) throw new Error("Invalid membership event.");
 return {id:event.id,account:event.account,type:event.type,objectId:id};
}
type Event=NonNullable<ReturnType<typeof parseMembershipEvent>>;
const idSchema=z.string().regex(/^[A-Za-z0-9_]{1,260}$/);
const tags=z.object({snoozer_membership:z.uuid(),snoozer_membership_offer:z.uuid()});
const nullableTags=z.object({snoozer_membership:z.string().optional(),snoozer_membership_offer:z.string().optional()});
async function fromMetadata(value:unknown,account:string,platform:string) {
 const metadata=nullableTags.parse(value??{});
 if(!metadata.snoozer_membership&&!metadata.snoozer_membership_offer) return null;
 const ids=tags.parse(metadata);
 const record=await getMembership(ids.snoozer_membership);
 if(!record||record.accountId!==account||record.platformId!==platform||record.offerId!==ids.snoozer_membership_offer) throw new Error("Membership event scope mismatch.");
 return record;
}
async function fromSubscription(stripe:Stripe,id:string,account:string,platform:string) {
 memberSubscriptionId.parse(id);
 const stored=await findMembership(account,id);
 if(stored) {if(stored.platformId!==platform) throw new Error("Platform mismatch.");return stored;}
 const value=z.object({id:z.literal(id),object:z.literal("subscription"),livemode:z.literal(false),metadata:z.unknown()})
 .parse(await stripe.subscriptions.retrieve(id,{}, {stripeAccount:account}));
 const record=await fromMetadata(value.metadata,account,platform);
 if(record&&record.subscriptionId!==id) throw new Error("Awaiting original Checkout binding.");
 return record;
}
async function invoiceMember(stripe:Stripe,id:string,event:Event,platform:string) {
 const value=await stripe.invoices.retrieve(id,{}, {stripeAccount:event.account});
 const header=z.object({id:z.literal(id),object:z.literal("invoice"),livemode:z.literal(false),parent:z.object({type:z.string()}).nullable()}).parse(value);
 if(header.parent?.type!=="subscription_details") return null;
 return fromSubscription(stripe,invoiceSubscription.parse(value).parent.subscription_details.subscription,event.account,platform);
}
async function riskMembers(stripe:Stripe,event:Event,platform:string) {
 const scope={stripeAccount:event.account};
 let chargeId=event.objectId;
 if(event.type.startsWith("charge.dispute.")) {
  const dispute=z.object({id:z.literal(event.objectId),object:z.literal("dispute"),livemode:z.literal(false),charge:idSchema})
   .parse(await stripe.disputes.retrieve(event.objectId,{},scope));chargeId=dispute.charge;
 } else if(event.type.startsWith("radar.")) {
  const warning=z.object({id:z.literal(event.objectId),object:z.literal("radar.early_fraud_warning"),livemode:z.literal(false),charge:idSchema})
   .parse(await stripe.radar.earlyFraudWarnings.retrieve(event.objectId,{},scope));chargeId=warning.charge;
 }
 const charge=z.object({id:z.literal(chargeId),object:z.literal("charge"),livemode:z.literal(false),payment_intent:z.string().regex(/^pi_[A-Za-z0-9]+$/).nullable()})
  .parse(await stripe.charges.retrieve(chargeId,{},scope));
 if(!charge.payment_intent) return [];
 const payments=z.object({has_more:z.literal(false),data:z.array(z.object({object:z.literal("invoice_payment"),livemode:z.literal(false),invoice:z.string().regex(/^in_[A-Za-z0-9]+$/),
 status:z.literal("paid"),payment:z.object({type:z.literal("payment_intent"),payment_intent:z.literal(charge.payment_intent)})})).max(100)})
 .parse(await stripe.invoicePayments.list({payment:{type:"payment_intent",payment_intent:charge.payment_intent},status:"paid",limit:100},scope));
 const result=new Map<string,MemberRecord>();
 for(const invoice of new Set(payments.data.map(p=>p.invoice))) {
  const record=await invoiceMember(stripe,invoice,event,platform);
  if(record) result.set(record.id,record);
 }
 return [...result.values()];
}
export async function processMembershipEvent(stripe:Stripe,platform:string,event:Event) {
 await assertCreatorPlatform(stripe,platform);
 const scope={stripeAccount:event.account};
 if(event.type.startsWith("checkout.session.")) {
  const value=await stripe.checkout.sessions.retrieve(event.objectId,{},scope);
  const header=z.object({id:z.literal(event.objectId),object:z.literal("checkout.session"),livemode:z.literal(false),metadata:z.unknown()}).parse(value);
  const m=await fromMetadata(header.metadata,event.account,platform);
  if(!m) return;
  const session=inspectMembershipCheckout(value,m);
  const bound=await bindMembership(m,session);
  if(!await stageMembershipEvent(bound,event.id,event.type,null)) return;
  if(bound.subscriptionId) await applyMembershipProof(stripe,bound,event.id);
  else {
   if(session.status==="expired") await expireMembership(bound);
   await finishMembershipCheckoutEvent(bound,event.id);
  }
  return;
 }
 if(event.type.startsWith("customer.subscription.")||event.type.startsWith("invoice.")) {
  const m=event.type.startsWith("invoice.")?await invoiceMember(stripe,event.objectId,event,platform):await fromSubscription(stripe,event.objectId,event.account,platform);
  if(m&&await stageMembershipEvent(m,event.id,event.type,null)) await applyMembershipProof(stripe,m,event.id);
  return;
 }
 const hold:MemberHold=event.type==="charge.refunded"?"refund":event.type.startsWith("charge.dispute.")?"dispute":"fraud";
 const members=await riskMembers(stripe,event,platform);
 // Stage all risk holds first; a failed provider read cannot skip a sibling.
 const pending:MemberRecord[]=[];
 for(const m of members) if(await stageMembershipEvent(m,event.id,event.type,hold)) pending.push(m);
 for(const m of pending) await applyMembershipProof(stripe,m,event.id);
}
export async function receiveMembershipWebhook(request:Request,secret:string,handle:(event:Event)=>Promise<void>) {
 const signature=request.headers.get("stripe-signature");
 if(!signature) return new Response(null,{status:400});
 let event:Event|null;
 try {const body=await boundedBody(request,256*1024);if(!body) return new Response(null,{status:413});
  event=parseMembershipEvent(Stripe.webhooks.constructEvent(body,signature,secret));
 } catch {return new Response(null,{status:400});}
 try {if(event) await handle(event);} catch {return new Response(null,{status:503});}
 return new Response(null,{status:204});
}
