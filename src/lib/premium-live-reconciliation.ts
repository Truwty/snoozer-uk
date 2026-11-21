import "server-only";
import Stripe from "stripe";
import { z } from "zod";
import { storageAdmin } from "./supabase";
import { verifyLiveSubscription, verifyLiveInvoice, premiumSubscriptionId } from "./premium-live-proof";

const mapping = z.object({
  owner_id: z.uuid(), customer_id: z.string().regex(/^cus_[A-Za-z0-9]{1,128}$/),
  price_id: z.string().regex(/^price_[A-Za-z0-9]{1,128}$/),
  revision: z.number().int().nonnegative(),
});

async function recordHold(subscriptionId: string, customerId: string, invoiceId: string, reason: "refund" | "dispute" | "fraud", eventId: string | null) {
  const { data, error } = await storageAdmin().rpc("hold_premium_live_invoice", {
    p_subscription: subscriptionId, p_customer: customerId, p_invoice: invoiceId,
    p_reason: reason, p_event: eventId,
  });
  if (error || data !== true) throw new Error("Live payment risk hold was not recorded.");
}

async function readInvoicePaymentRisk(stripe: Stripe, invoiceId: string, subscriptionId: string, customerId: string) {
  const payments = await stripe.invoicePayments.list({ invoice: invoiceId, status: "paid", limit: 2 });
  if (payments.has_more || payments.data.length !== 1) throw new Error("Ambiguous paid invoice payment.");
  const payment = payments.data[0];
  if (!payment.livemode || payment.status !== "paid" || payment.payment.type !== "payment_intent")
    throw new Error("Invalid invoice payment.");
  const piId = payment.payment.payment_intent;
  if (typeof piId !== "string") throw new Error("Invoice payment lacks PaymentIntent.");
  const pi = await stripe.paymentIntents.retrieve(piId);
  const chargeId = typeof pi.latest_charge === "string" ? pi.latest_charge : pi.latest_charge?.id;
  if (!pi.livemode || pi.status !== "succeeded" || pi.customer !== customerId || !chargeId)
    throw new Error("Invoice payment could not be verified.");
  const charge = await stripe.charges.retrieve(chargeId);
  if (!charge.livemode || !charge.paid || !charge.captured || charge.status !== "succeeded"
    || charge.payment_intent !== pi.id || charge.customer !== customerId)
    throw new Error("Charge does not belong to the subscription customer.");
  const [disputes, warnings] = await Promise.all([
    stripe.disputes.list({ charge: charge.id, limit: 1 }),
    stripe.radar.earlyFraudWarnings.list({ charge: charge.id, limit: 1 }),
  ]);
  if (charge.amount_refunded > 0 || charge.refunded) {
    await recordHold(subscriptionId, customerId, invoiceId, "refund", null);
    return false;
  }
  if (charge.disputed || disputes.data.length > 0) {
    await recordHold(subscriptionId, customerId, invoiceId, "dispute", null);
    return false;
  }
  if (warnings.data.length > 0 || charge.fraud_details?.user_report === "fraudulent"
    || charge.fraud_details?.stripe_report === "fraudulent"
    || charge.outcome?.risk_level === "highest") {
    await recordHold(subscriptionId, customerId, invoiceId, "fraud", null);
    return false;
  }
  return true;
}

export async function reconcilePremiumLiveSubscription(stripe: Stripe, rawId: string) {
  const subscriptionId = premiumSubscriptionId.parse(rawId);
  const admin = storageAdmin();
  const start = await admin.rpc("start_premium_live_reconciliation", { p_subscription: subscriptionId }).maybeSingle();
  if (start.error) throw new Error("Live subscription lookup unavailable.");
  // Stripe often delivers subscription.created before checkout.session.completed.
  // Checkout completion is independently read back and triggers this again.
  if (!start.data) return false;
  const bound = mapping.parse(start.data);
  const rawSubscription = await stripe.subscriptions.retrieve(subscriptionId);
  const proof = verifyLiveSubscription(rawSubscription, bound.customer_id);
  if (proof.id !== subscriptionId || !proof.priceId) throw new Error("Stripe subscription identity mismatch.");
  let invoice: string | null = null;
  let verifiedPaid = false;
  if (proof.eligibleStatus && proof.invoiceId) {
    const rawInvoice = await stripe.invoices.retrieve(proof.invoiceId);
    const paid = verifyLiveInvoice(rawInvoice, subscriptionId, bound.customer_id, proof.amount);
    invoice = paid.id;
    if (paid.paid) verifiedPaid = await readInvoicePaymentRisk(stripe, invoice, subscriptionId, bound.customer_id);
  }
  const result = await admin.rpc("apply_premium_live_reconciliation", {
    p_subscription: subscriptionId, p_customer: bound.customer_id, p_revision: bound.revision,
    p_stripe_status: proof.status, p_price: proof.priceId,
    p_invoice: invoice, p_starts: proof.starts, p_ends: proof.ends,
    p_verified_paid: verifiedPaid,
  });
  if (result.error || result.data !== true) throw new Error("Live subscription reconciliation must be retried.");
  return true;
}

export async function holdPremiumLiveRiskEvent(stripe: Stripe, receipt: {
  id: string; type: string; objectId: string;
}) {
  let chargeId: string | null = null;
  let reason: "refund" | "dispute" | "fraud";
  if (receipt.type === "charge.refunded") {
    chargeId = receipt.objectId;
    reason = "refund";
  } else if (receipt.type.startsWith("charge.dispute.")) {
    const dispute = await stripe.disputes.retrieve(receipt.objectId);
    if (!dispute.livemode || dispute.id !== receipt.objectId) throw new Error("Unexpected dispute.");
    chargeId = typeof dispute.charge === "string" ? dispute.charge : dispute.charge?.id ?? null;
    reason = "dispute"; // Conservative: a won dispute needs separate documented review.
  } else if (receipt.type === "radar.early_fraud_warning.created") {
    const warning = await stripe.radar.earlyFraudWarnings.retrieve(receipt.objectId);
    if (!warning.livemode || warning.id !== receipt.objectId) throw new Error("Unexpected fraud warning.");
    chargeId = typeof warning.charge === "string" ? warning.charge : warning.charge?.id ?? null;
    reason = "fraud";
  } else return;

  if (!chargeId) throw new Error("Risk event lacks a charge.");
  const charge = await stripe.charges.retrieve(chargeId);
  if (!charge.livemode || charge.id !== chargeId || typeof charge.payment_intent !== "string"
    || typeof charge.customer !== "string") throw new Error("Risk charge identity mismatch.");
  if (reason === "refund" && charge.amount_refunded <= 0) return;
  const subscriptions = new Set<string>();
  for await (const payment of stripe.invoicePayments.list({
    payment: { type: "payment_intent", payment_intent: charge.payment_intent },
    status: "paid", expand: ["data.invoice"], limit: 10,
  })) {
    const invoice = payment.invoice;
    if (!payment.livemode || typeof invoice === "string" || invoice.deleted || !invoice.livemode
      || invoice.customer !== charge.customer) continue;
    const subscriptionId = invoice.parent?.subscription_details?.subscription;
    if (typeof subscriptionId !== "string") continue;
    const saved = await storageAdmin().rpc("hold_premium_live_invoice", {
      p_event: receipt.id, p_invoice: invoice.id,
      p_subscription: subscriptionId, p_customer: charge.customer, p_reason: reason,
    });
    // Not all charges are associated with a Snoozer premium subscription.
    if (saved.error) throw new Error("Live risk hold write failed.");
    if (saved.data === true) subscriptions.add(subscriptionId);
  }
  for (const id of subscriptions) await reconcilePremiumLiveSubscription(stripe, id);
}
