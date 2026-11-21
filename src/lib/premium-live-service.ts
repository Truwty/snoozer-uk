import "server-only";
import Stripe from "stripe";
import { z } from "zod";
import { premiumLiveCheckoutConfig, premiumLivePortalConfig, premiumLiveReadConfig } from "./premium-live-config";
import { premiumAttempt, premiumCustomerId, premiumInterval, premiumLiveOffer, premiumPlan, verifyLiveCheckoutSession, verifiedLiveStripeUrl } from "./premium-live-proof";
import { storageAdmin } from "./supabase";
import { siteUrl } from "./env";

export async function premiumLiveOffers() {
  if (!premiumLiveCheckoutConfig()) return [];
  const { data, error } = await storageAdmin().rpc("list_premium_live_offers");
  if (error) return [];
  return z.array(premiumLiveOffer).max(12).parse(data);
}

async function verifiedStripeAccount(stripe: Stripe, accountId: string) {
  const account = await stripe.accounts.retrieve(accountId);
  if (account.id !== accountId || !account.charges_enabled || !account.details_submitted)
    throw new Error("Live Stripe platform account has not been verified.");
}

export async function openPremiumLiveCheckout(ownerId: string, chosenPlan: unknown, chosenInterval: unknown) {
  const config = premiumLiveCheckoutConfig();
  const plan = premiumPlan.parse(chosenPlan);
  const interval = premiumInterval.parse(chosenInterval);
  if (!config) throw new Error("Premium live Checkout is not enabled.");
  const stripe = new Stripe(config.key, { timeout: 8000, maxNetworkRetries: 1 });
  const admin = storageAdmin();
  const offers = await premiumLiveOffers();
  const offer = offers.find(v => v.plan === plan && v.billing_interval === interval);
  if (!offer) throw new Error("Premium price is not approved.");
  await verifiedStripeAccount(stripe, config.accountId);

  const prepared = await admin.rpc("prepare_premium_live_checkout", { p_owner: ownerId, p_price: offer.price_id });
  if (prepared.error || !prepared.data) throw new Error("Existing billing attempt requires reconciliation.");
  const attempt = premiumAttempt.parse(prepared.data);
  if (attempt.amount !== offer.unit_amount || attempt.interval !== interval || attempt.priceId !== offer.price_id)
    throw new Error("Premium price changed.");
  let customerId = attempt.customerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      metadata: { snoozer_owner: ownerId },
    }, { idempotencyKey: "snoozer-live-customer-" + attempt.id });
    if (!customer.id || !customer.livemode) throw new Error("Stripe customer must be live.");
    customerId = premiumCustomerId.parse(customer.id);
    const saved = await admin.rpc("bind_premium_live_customer", {
      p_owner: ownerId, p_attempt: attempt.id, p_customer: customerId,
    });
    if (saved.error || saved.data !== true) throw new Error("Customer ownership could not be bound.");
  }

  let session: Stripe.Checkout.Session;
  if (attempt.sessionId) {
    session = await stripe.checkout.sessions.retrieve(attempt.sessionId);
  } else {
    const price = await stripe.prices.retrieve(attempt.priceId);
    if (!price.livemode || !price.active || price.currency !== "gbp" || price.unit_amount !== attempt.amount
      || price.recurring?.interval !== interval || price.recurring.interval_count !== 1
      || price.recurring.usage_type !== "licensed") throw new Error("Stripe Price does not match the approved catalogue.");
    const dest = new URL("/studio/plan", siteUrl());
    session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: ownerId,
      line_items: [{ price: attempt.priceId, quantity: 1 }],
      billing_address_collection: "required",
      customer_update: { address: "auto" },
      automatic_tax: { enabled: false },
      success_url: new URL("?premium=processing", dest).href,
      cancel_url: new URL("?premium=cancelled", dest).href,
      expires_at: attempt.expires,
      subscription_data: { metadata: { snoozer_owner: ownerId } },
      metadata: { snoozer_owner: ownerId, snoozer_attempt: attempt.id },
    }, { idempotencyKey: "snoozer-live-checkout-" + attempt.id });
  }

  const valid = verifyLiveCheckoutSession(session, ownerId, customerId, attempt.sessionId ?? undefined);
  const saved = await admin.rpc("bind_premium_live_session", {
    p_owner: ownerId, p_attempt: attempt.id, p_customer: customerId, p_session: valid.id,
  });
  if (saved.error || saved.data !== true) throw new Error("Checkout session could not be safely bound.");
  if (valid.status !== "open" || !valid.url) throw new Error("Checkout is closed. Contact support for reconciliation.");
  return verifiedLiveStripeUrl(valid.url, "checkout.stripe.com");
}

export async function openPremiumLivePortal(ownerId: string) {
  const config = premiumLivePortalConfig();
  if (!config) throw new Error("Premium Billing Portal is not configured.");
  const admin = storageAdmin();
  const result = await admin.rpc("get_premium_live_customer", { p_owner: ownerId });
  if (result.error || !result.data) throw new Error("No verified Premium Stripe customer.");
  const customerId = premiumCustomerId.parse(result.data);
  const stripe = new Stripe(config.key, { timeout: 8000, maxNetworkRetries: 0 });
  const [customer, portal, account] = await Promise.all([
    stripe.customers.retrieve(customerId),
    stripe.billingPortal.configurations.retrieve(config.portalId),
    stripe.accounts.retrieve(config.accountId),
  ]);
  if (account.id !== config.accountId || customer.deleted || !customer.livemode
    || !portal.active || !portal.livemode || !portal.features.subscription_cancel.enabled
    || !portal.features.payment_method_update.enabled)
    throw new Error("Billing Portal configuration is not approved.");
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    configuration: portal.id,
    return_url: new URL("/studio/plan", siteUrl()).href,
  });
  if (!session.livemode || session.customer !== customerId || session.configuration !== portal.id)
    throw new Error("Billing Portal session mismatch.");
  return verifiedLiveStripeUrl(session.url, "billing.stripe.com");
}

export async function premiumLiveBillingStatus() {
  const enabled = Boolean(premiumLiveReadConfig());
  return { providerConfigured: enabled, checkoutConfigured: Boolean(premiumLiveCheckoutConfig()) };
}
