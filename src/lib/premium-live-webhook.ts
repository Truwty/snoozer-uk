import "server-only";
import Stripe from "stripe";
import { z } from "zod";
import { boundedBody } from "./bounded-request";
import { premiumLiveWebhookConfig } from "./premium-live-config";
import { verifyLiveCheckoutSession } from "./premium-live-proof";
import { reconcilePremiumLiveSubscription, holdPremiumLiveRiskEvent } from "./premium-live-reconciliation";
import { storageAdmin } from "./supabase";

const eventId = z.string().regex(/^evt_[A-Za-z0-9]{1,128}$/);
const types = new Set([
  "checkout.session.completed", "checkout.session.async_payment_succeeded",
  "checkout.session.expired", "customer.subscription.created",
  "customer.subscription.updated", "customer.subscription.deleted",
  "invoice.paid", "invoice.payment_failed", "invoice.payment_action_required",
  "invoice.finalization_failed", "charge.refunded", "charge.dispute.created",
  "charge.dispute.closed", "radar.early_fraud_warning.created",
]);

async function processPremiumLiveEvent(stripe: Stripe, event: Stripe.Event) {
  if (!types.has(event.type)) return;
  const id = eventId.parse(event.id);
  const objectId = z.string().min(4).max(150).parse(event.data.object?.id);
  const occurred = new Date(event.created * 1000).toISOString();
  const admin = storageAdmin();
  const recorded = await admin.rpc("record_premium_live_receipt", {
    p_id: id, p_type: event.type, p_object: objectId, p_occurred: occurred,
  });
  if (recorded.error) throw new Error("Payment receipt could not be committed.");
  if (recorded.data === false) return; // Previously fully processed event, safe repeated delivery.

  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const session = await stripe.checkout.sessions.retrieve(objectId);
    if (!session.livemode || session.mode !== "subscription" || session.status !== "complete")
      throw new Error("Live subscription Checkout is not complete.");
    if (typeof session.customer !== "string" || typeof session.client_reference_id !== "string"
      || typeof session.subscription !== "string") throw new Error("Checkout ownership unavailable.");
    const checked = verifyLiveCheckoutSession(session, session.client_reference_id, session.customer, objectId);
    const bound = await admin.rpc("bind_premium_live_subscription", {
      p_owner: checked.client_reference_id, p_customer: checked.customer,
      p_session: checked.id, p_subscription: checked.subscription,
    });
    if (bound.error) throw new Error("Subscription could not be bound to Snoozer.");
    if (bound.data === true) await reconcilePremiumLiveSubscription(stripe, checked.subscription!);
    // Unrelated account Checkout events aren't Snoozer offers.
  } else if (event.type === "checkout.session.expired") {
    const session = await stripe.checkout.sessions.retrieve(objectId);
    if (!session.livemode || session.status !== "expired") throw new Error("Checkout expiry not confirmed.");
    if (session.mode === "subscription" && session.subscription === null
      && typeof session.customer === "string" && typeof session.client_reference_id === "string") {
      const expired = await admin.rpc("expire_premium_live_checkout", {
        p_owner: session.client_reference_id, p_customer: session.customer, p_session: session.id,
      });
      if (expired.error) throw new Error("Cannot safely expire Checkout.");
    }
  } else if (event.type.startsWith("customer.subscription.")) {
    await reconcilePremiumLiveSubscription(stripe, objectId);
  } else if (event.type.startsWith("invoice.")) {
    const invoice = await stripe.invoices.retrieve(objectId);
    if (!invoice.livemode || invoice.id !== objectId) throw new Error("Invoice account mismatch.");
    const sub = invoice.parent?.subscription_details?.subscription;
    if (typeof sub === "string") await reconcilePremiumLiveSubscription(stripe, sub);
  } else {
    await holdPremiumLiveRiskEvent(stripe, { id, type: event.type, objectId });
  }
  const finished = await admin.rpc("finish_premium_live_receipt", { p_id: id });
  if (finished.error || finished.data !== true) throw new Error("Payment receipt acknowledgement must be retried.");
}

export async function receivePremiumLiveWebhook(request: Request) {
  const config = premiumLiveWebhookConfig();
  if (!config) return new Response(null, { status: 503 });
  const signature = request.headers.get("stripe-signature");
  if (!signature) return new Response(null, { status: 400 });
  let event: Stripe.Event;
  try {
    const body = await boundedBody(request, 256 * 1024);
    if (!body) return new Response(null, { status: 413 });
    event = Stripe.webhooks.constructEvent(body, signature, config.secret);
    if (!event.livemode || event.account) throw new Error("Unexpected Connect/test event.");
  } catch {
    return new Response(null, { status: 400 });
  }
  try {
    const stripe = new Stripe(config.key, { timeout: 8000, maxNetworkRetries: 1 });
    const account = await stripe.accounts.retrieve();
    if (account.id !== config.accountId) throw new Error("Incorrect Stripe platform.");
    await processPremiumLiveEvent(stripe, event);
    return new Response(null, { status: 204 });
  } catch {
    // Never acknowledge unpersisted/unreconciled events: Stripe will retry.
    return new Response(null, { status: 503 });
  }
}
