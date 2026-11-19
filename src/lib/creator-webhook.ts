import Stripe from "stripe";
import { z } from "zod";
import { boundedBody } from "./bounded-request";
import { stripeAccountId } from "./creator-merchant";

const objects = {
  "checkout.session.completed": ["checkout.session", "cs_test_"],
  "checkout.session.async_payment_succeeded": ["checkout.session", "cs_test_"],
  "checkout.session.async_payment_failed": ["checkout.session", "cs_test_"],
  "checkout.session.expired": ["checkout.session", "cs_test_"],
  "charge.refunded": ["charge", "ch_"],
  "charge.dispute.created": ["dispute", "du_"],
  "charge.dispute.updated": ["dispute", "du_"],
  "charge.dispute.closed": ["dispute", "du_"],
  "radar.early_fraud_warning.created": ["radar.early_fraud_warning", "issfr_"],
  "radar.early_fraud_warning.updated": ["radar.early_fraud_warning", "issfr_"],
} as const;
const eventSchema = z.object({ object:z.literal("event"), id:z.string().regex(/^evt_[A-Za-z0-9]{1,128}$/), type:z.string(),
  account:stripeAccountId, context:z.null().optional(), livemode:z.literal(false),
  created:z.number().int().positive().max(253402300799),
  data:z.object({object:z.object({id:z.string(),object:z.string(),livemode:z.literal(false)})}),
});
export type CreatorReceipt = {id:string; accountId:string; type:string; objectId:string; occurredAt:string};

export function creatorSandboxReceipt(value:unknown):CreatorReceipt|null {
  const event=eventSchema.parse(value);
  if(!Object.hasOwn(objects,event.type)) return null;
  const [kind,prefix]=objects[event.type as keyof typeof objects];
  const item=event.data.object;
  const suffix=item.id.slice(prefix.length);
  if(item.object!==kind||!item.id.startsWith(prefix)||!/^[A-Za-z0-9]+$/.test(suffix)||suffix.length>(prefix==="cs_test_"?255:128)) throw new Error("Invalid connected-account event object.");
  return {id:event.id,accountId:event.account,type:event.type,objectId:item.id,occurredAt:new Date(event.created*1000).toISOString()};
}

export async function receiveCreatorWebhook(request:Request,secret:string|undefined,record:(receipt:CreatorReceipt)=>Promise<void>) {
  if(!secret||!/^whsec_[A-Za-z0-9_]{20,512}$/.test(secret)) return new Response(null,{status:503});
  const signature=request.headers.get("stripe-signature");
  if(!signature) return new Response(null,{status:400});
  let receipt:CreatorReceipt|null;
  try {
    const body=await boundedBody(request,256*1024);
    if(!body) return new Response(null,{status:413});
    receipt=creatorSandboxReceipt(Stripe.webhooks.constructEvent(body,signature,secret));
  } catch {return new Response(null,{status:400});}
  if(receipt) {
    try {await record(receipt);} catch {return new Response(null,{status:503});}
  }
  return new Response(null,{status:204});
}
