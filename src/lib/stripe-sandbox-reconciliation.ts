import "server-only";
import Stripe from "stripe";
import { z } from "zod";
import { storageAdmin } from "@/lib/supabase";

const mappingShape = z.object({ customer_id: z.string(), price_id: z.string(), revision: z.number().int() });

export async function reconcileSandboxSubscription(
  stripe: Stripe,
  receipt: { type: string; objectId: string },
  checkoutSubscription?: string,
  reportDrift = false,
) {
  let subscriptionId = checkoutSubscription;
  if (receipt.type.startsWith("customer.subscription.")) subscriptionId = receipt.objectId;
  if (receipt.type === "invoice.paid" || receipt.type === "invoice.payment_failed") {
    const invoice = await stripe.invoices.retrieve(receipt.objectId);
    if (invoice.livemode || invoice.id !== receipt.objectId) throw new Error("Unexpected Stripe invoice.");
    const fromInvoice = invoice.parent?.subscription_details?.subscription;
    if (typeof fromInvoice === "string") subscriptionId = fromInvoice;
  }
  if (!subscriptionId) return;

  const admin = storageAdmin();
  const { data, error } = await admin.rpc("start_stripe_sandbox_reconciliation", {
    p_subscription: subscriptionId,
  }).maybeSingle();
  if (error) throw new Error("Subscription reconciliation could not start.");
  if (!data) return;
  const mapping = mappingShape.parse(data);

  const subscription = await stripe.subscriptions.retrieve(subscriptionId, { expand: ["latest_invoice"] });
  if (subscription.livemode || subscription.id !== subscriptionId || subscription.customer !== mapping.customer_id) {
    throw new Error("Stripe subscription ownership changed.");
  }
  const [item] = subscription.items.data;
  const invoice = subscription.latest_invoice;
  const paid = subscription.status === "active" && subscription.pause_collection === null
    && !subscription.items.has_more && subscription.items.data.length === 1
    && item.price.id === mapping.price_id && item.quantity === 1
    && invoice && typeof invoice !== "string" && !invoice.livemode && invoice.status === "paid"
    && invoice.customer === mapping.customer_id
    && invoice.parent?.subscription_details?.subscription === subscriptionId;
  const end = paid ? Math.min(item.current_period_end, subscription.cancel_at ?? item.current_period_end) : null;

  const operation = reportDrift ? "sweep_stripe_sandbox_grant" : "apply_stripe_sandbox_reconciliation";
  const applied = await admin.rpc(operation, {
    p_subscription: subscriptionId, p_customer: mapping.customer_id, p_price: mapping.price_id,
    p_revision: mapping.revision,
    p_invoice: paid ? invoice.id : null,
    p_starts: paid ? new Date(item.current_period_start * 1000).toISOString() : null,
    p_ends: end === null ? null : new Date(end * 1000).toISOString(),
  });
  if (!applied.error && (applied.data === true || applied.data === "changed" || applied.data === "unchanged")) {
    return applied.data === "changed";
  }
  throw new Error("Stripe reconciliation must be retried.");
}
