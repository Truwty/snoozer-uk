import "server-only";
import type Stripe from "stripe";
import { storageAdmin } from "@/lib/supabase";

export async function recordSandboxInvoiceHolds(stripe: Stripe, receipt: { id: string; type: string; objectId: string }) {
  let chargeId: string | Stripe.Charge = receipt.objectId;
  if (receipt.type === "charge.dispute.created") {
    const dispute = await stripe.disputes.retrieve(receipt.objectId);
    if (dispute.livemode || dispute.id !== receipt.objectId) throw new Error("Unexpected Stripe dispute.");
    chargeId = dispute.charge;
  } else if (receipt.type === "radar.early_fraud_warning.created") {
    const warning = await stripe.radar.earlyFraudWarnings.retrieve(receipt.objectId);
    if (warning.livemode || warning.id !== receipt.objectId) throw new Error("Unexpected Stripe fraud warning.");
    chargeId = warning.charge;
  } else if (receipt.type !== "charge.refunded") {
    return [];
  }

  const charge = typeof chargeId === "string" ? await stripe.charges.retrieve(chargeId) : chargeId;
  if (charge.livemode || (typeof chargeId === "string" && charge.id !== chargeId)) {
    throw new Error("Unexpected Stripe charge.");
  }
  if (receipt.type === "charge.refunded" && charge.amount_refunded <= 0) return [];
  if (typeof charge.payment_intent !== "string" || typeof charge.customer !== "string") return [];

  const subscriptions = new Set<string>();
  const admin = storageAdmin();
  for await (const payment of stripe.invoicePayments.list({
    payment: { type: "payment_intent", payment_intent: charge.payment_intent },
    status: "paid", expand: ["data.invoice"],
  })) {
    const invoice = payment.invoice;
    if (payment.livemode || typeof invoice === "string" || invoice.deleted) continue;
    const subscription = invoice.parent?.subscription_details?.subscription;
    if (invoice.livemode || invoice.customer !== charge.customer || typeof subscription !== "string") continue;
    const { error } = await admin.rpc("record_stripe_sandbox_invoice_hold", {
      p_event: receipt.id, p_invoice: invoice.id, p_subscription: subscription, p_customer: charge.customer,
    });
    if (error) throw new Error("Invoice hold could not be saved.");
    subscriptions.add(subscription);
  }
  return [...subscriptions];
}
