import "server-only";
import type Stripe from "stripe";
import { z } from "zod";
import { creatorCheckoutId, creatorCheckoutUrl, creatorOrder, type CreatorOrder } from "./creator-orders";
import { assertCreatorPlatform } from "./creator-stripe";
import { storageAdmin } from "./supabase";
import type { CreatorReceipt } from "./creator-webhook";

const paymentId=z.string().regex(/^pi_[A-Za-z0-9]{1,128}$/);
const chargeId=z.string().regex(/^ch_[A-Za-z0-9]{1,128}$/);
const orderMetadata=z.object({snoozer_order:z.uuid(),snoozer_version:z.uuid()});
const chargeSchema=z.object({id:chargeId,object:z.literal("charge"),livemode:z.literal(false),amount:z.number().int(),currency:z.literal("gbp"),
  payment_intent:paymentId,paid:z.boolean(),captured:z.boolean(),status:z.enum(["failed","pending","succeeded"]),
  amount_refunded:z.number().int().nonnegative(),refunded:z.boolean(),disputed:z.boolean(),
  fraud_details:z.object({user_report:z.string().optional(),stripe_report:z.string().optional()}).nullable(),
  outcome:z.object({risk_level:z.string().optional()}).nullable(),application_fee:z.null(),application_fee_amount:z.null(),on_behalf_of:z.null(),transfer_data:z.null(),
});

export function inspectCreatorCheckout(value:unknown,input:CreatorOrder) {
  const order=creatorOrder.parse(input);
  const metadata=z.object({snoozer_order:z.literal(order.id),snoozer_version:z.literal(order.versionId)});
  const session=z.object({id:creatorCheckoutId,object:z.literal("checkout.session"),livemode:z.literal(false),mode:z.literal("payment"),
    status:z.enum(["open","complete","expired"]),payment_status:z.enum(["paid","unpaid","no_payment_required"]),
    currency:z.literal("gbp"),amount_subtotal:z.literal(order.amount),amount_total:z.literal(order.amount),
    client_reference_id:z.literal(order.id),metadata,created:z.number().int().positive(),expires_at:z.number().int().positive(),
    total_details:z.object({amount_discount:z.literal(0),amount_shipping:z.literal(0),amount_tax:z.literal(0)}),
    line_items:z.object({object:z.literal("list"),has_more:z.literal(false),data:z.array(z.object({object:z.literal("item"),quantity:z.literal(1),
      amount_subtotal:z.literal(order.amount),amount_total:z.literal(order.amount),currency:z.literal("gbp"),
      price:z.object({currency:z.literal("gbp"),unit_amount:z.literal(order.amount),type:z.literal("one_time"),recurring:z.null()})})).length(1)}),
    payment_intent:z.object({id:paymentId,object:z.literal("payment_intent"),livemode:z.literal(false),metadata,
      amount:z.literal(order.amount),currency:z.literal("gbp"),amount_received:z.number().int().nonnegative(),
      status:z.enum(["requires_payment_method","requires_confirmation","requires_action","processing","requires_capture","canceled","succeeded"]),
      application_fee_amount:z.null(),on_behalf_of:z.null(),transfer_data:z.null(),latest_charge:chargeSchema.nullable(),
    }).nullable(),
  }).parse(value);
  const created=Date.parse(order.createdAt);
  if((order.checkoutId&&order.checkoutId!==session.id)||(order.checkoutExpiresAt&&Date.parse(order.checkoutExpiresAt)!==session.expires_at*1000)
    ||session.created*1000<created-5000||session.created*1000>created+23*3600000
    ||session.expires_at*1000<created+1800000||session.expires_at*1000>created+86400000) throw new Error("Checkout binding mismatch.");
  const payment=session.payment_intent,charge=payment?.latest_charge;
  if((order.paymentId&&order.paymentId!==payment?.id)||(order.chargeId&&order.chargeId!==charge?.id)
    ||(charge&&(charge.payment_intent!==payment!.id||charge.amount!==order.amount||charge.amount_refunded>order.amount))) throw new Error("Payment binding mismatch.");
  const holds:CreatorOrder["holds"]=[];
  if(charge?.refunded||(charge?.amount_refunded??0)>0) holds.push("refund");
  if(charge?.disputed) holds.push("dispute");
  if(charge?.fraud_details?.user_report==="fraudulent"||charge?.fraud_details?.stripe_report==="fraudulent"||charge?.outcome?.risk_level==="highest") holds.push("fraud");
  const paid=session.status==="complete"&&session.payment_status==="paid"&&payment?.status==="succeeded"
    &&payment.amount_received===order.amount&&charge?.paid&&charge.captured&&charge.status==="succeeded";
  // Any contradictory paid claim is an unavailable proof, never a pending success.
  if((order.state==="paid"||session.payment_status==="paid"||payment?.status==="succeeded")&&!paid) throw new Error("Incomplete payment proof.");
  const failed=session.status==="complete"&&["canceled","requires_payment_method"].includes(payment?.status??"");
  return {checkoutId:session.id,createdAt:new Date(session.created*1000).toISOString(),expiresAt:new Date(session.expires_at*1000).toISOString(),
    paymentId:payment?.id??null,chargeId:charge?.paid&&charge.captured&&charge.status==="succeeded"?charge.id:null,
    state:paid?"paid" as const:session.status==="expired"||failed?"expired" as const:"pending" as const,holds};
}

export async function readCreatorCheckout(stripe:Stripe,order:CreatorOrder,sessionId=order.checkoutId) {
  if(!sessionId) throw new Error("Checkout is not bound.");
  const session=await stripe.checkout.sessions.retrieve(sessionId,{expand:["payment_intent.latest_charge","line_items"]},{stripeAccount:order.accountId});
  if(session.id!==sessionId) throw new Error("Unexpected Checkout.");
  const proof=inspectCreatorCheckout(session,order);
  if(proof.chargeId) {
    const warnings=z.object({object:z.literal("list"),has_more:z.boolean(),data:z.array(z.object({object:z.literal("radar.early_fraud_warning"),
      id:z.string().regex(/^issfr_[A-Za-z0-9]{1,128}$/),livemode:z.literal(false),charge:z.literal(proof.chargeId)})).max(1)})
      .parse(await stripe.radar.earlyFraudWarnings.list({charge:proof.chargeId,limit:1},{stripeAccount:order.accountId}));
    if(warnings.has_more&&!warnings.data.length) throw new Error("Incomplete fraud review.");
    if(warnings.data.length&&!proof.holds.includes("fraud")) proof.holds.push("fraud");
  }
  return {...proof,checkoutUrl:session.status==="open"?creatorCheckoutUrl(session.url):null};
}

export async function reconcileCreatorOrder(stripe:Stripe,order:CreatorOrder,receipt?:CreatorReceipt,sessionId=order.checkoutId,signalCharge?:string) {
  const proof=await readCreatorCheckout(stripe,order,sessionId);
  if(signalCharge&&proof.chargeId!==signalCharge) throw new Error("Signal charge mismatch.");
  // Event history remains conservative even after a dispute is won or a warning is resolved.
  if(receipt?.type.startsWith("charge.dispute.")&&!proof.holds.includes("dispute")) proof.holds.push("dispute");
  if(receipt?.type.startsWith("radar.early_fraud_warning.")&&!proof.holds.includes("fraud")) proof.holds.push("fraud");
  if(receipt?.type==="charge.refunded"&&!proof.holds.includes("refund")) proof.holds.push("refund");
  const admin=storageAdmin();
  if(!order.checkoutId) {
    if(!receipt) throw new Error("Unbound Checkout requires a receipt.");
    const bound=await admin.rpc("recover_creator_sandbox_checkout",{p_order:order.id,p_receipt:receipt.id,p_checkout:proof.checkoutId,p_created:proof.createdAt,p_expires:proof.expiresAt});
    if(bound.error||bound.data!==true) throw new Error("Checkout recovery failed.");
  }
  const saved=await admin.rpc("reconcile_creator_sandbox_order",{p_order:order.id,p_platform:order.platformId,p_account:order.accountId,p_checkout:proof.checkoutId,
    p_payment:proof.paymentId,p_charge:proof.chargeId,p_state:proof.state,p_holds:proof.holds,p_receipt:receipt?.id??null});
  if(saved.error) throw new Error("Order reconciliation failed.");
  return creatorOrder.parse(saved.data);
}

export async function processCreatorReceipt(stripe:Stripe,platformId:string,receipt:CreatorReceipt) {
  const admin=storageAdmin();
  const saved=await admin.rpc("record_creator_sandbox_receipt",{p_id:receipt.id,p_platform:platformId,p_account:receipt.accountId,p_type:receipt.type,p_object:receipt.objectId,p_occurred_at:receipt.occurredAt});
  if(saved.error) throw new Error("Creator receipt could not be saved.");
  if(saved.data===false) return;
  if(saved.data!==true) throw new Error("Invalid receipt result.");
  await assertCreatorPlatform(stripe,platformId);
  const scope={stripeAccount:receipt.accountId};
  let checkoutId:string|undefined, identity:unknown, signalCharge:string|undefined;
  if(receipt.type.startsWith("checkout.session.")) {
    const session=await stripe.checkout.sessions.retrieve(receipt.objectId,{},scope);
    if(session.id!==receipt.objectId||session.livemode||session.object!=="checkout.session") throw new Error("Unexpected Checkout event.");
    identity=session.metadata;checkoutId=session.id;
  } else {
    let id=receipt.objectId;
    if(receipt.type.startsWith("charge.dispute.")) {
      const signal=z.object({id:z.literal(id),object:z.literal("dispute"),livemode:z.literal(false),charge:chargeId}).parse(await stripe.disputes.retrieve(id,{},scope));id=signal.charge;
    } else if(receipt.type.startsWith("radar.early_fraud_warning.")) {
      const signal=z.object({id:z.literal(id),object:z.literal("radar.early_fraud_warning"),livemode:z.literal(false),charge:chargeId})
        .parse(await stripe.radar.earlyFraudWarnings.retrieve(id,{},scope));id=signal.charge;
    }
    const charge=z.object({id:z.literal(id),object:z.literal("charge"),livemode:z.literal(false),
      payment_intent:z.object({id:paymentId,object:z.literal("payment_intent"),livemode:z.literal(false),metadata:z.record(z.string(),z.string())})})
      .parse(await stripe.charges.retrieve(id,{expand:["payment_intent"]},scope));
    identity=charge.payment_intent.metadata;signalCharge=charge.id;
  }
  const ids=orderMetadata.safeParse(identity);
  if(!ids.success) {
    // Unrelated payments on the creator's own Dashboard are not Snoozer orders.
    const ignored=await admin.rpc("ignore_creator_sandbox_receipt",{p_id:receipt.id,p_platform:platformId,p_account:receipt.accountId});
    if(ignored.error||ignored.data!==true) throw new Error("Receipt disposition failed.");
    return;
  }
  const found=await admin.rpc("get_creator_sandbox_order",{p_order:ids.data.snoozer_order});
  if(found.error) throw new Error("Order lookup failed.");
  const order=creatorOrder.parse(found.data);
  if(order.accountId!==receipt.accountId||order.platformId!==platformId||order.versionId!==ids.data.snoozer_version
    ||(signalCharge&&order.chargeId&&order.chargeId!==signalCharge)) throw new Error("Receipt/order scope mismatch.");
  await reconcileCreatorOrder(stripe,order,receipt,checkoutId??order.checkoutId,signalCharge);
}
