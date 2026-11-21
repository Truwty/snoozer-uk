// Read-only launch gate inspection. Never changes Stripe, Supabase or Render.
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const blockers = [];
const ok = [];
const requireValue = (name, pattern) => {
  const value = process.env[name];
  if (!value || (pattern && !pattern.test(value))) {
    blockers.push(name + " is missing or invalid");
    return null;
  }
  return value;
};
const flagged = (name) => {
  if (process.env[name] !== "true") blockers.push(name + " has not been approved");
};
const key = requireValue("STRIPE_PREMIUM_LIVE_API_KEY", /^(rk|sk)_live_[A-Za-z0-9_]{12,}$/);
const account = requireValue("STRIPE_PREMIUM_LIVE_ACCOUNT_ID", /^acct_[A-Za-z0-9]{1,128}$/);
const secret = requireValue("STRIPE_PREMIUM_LIVE_WEBHOOK_SECRET", /^whsec_[A-Za-z0-9_]{20,512}$/);
const portalId = requireValue("STRIPE_PREMIUM_LIVE_PORTAL_CONFIGURATION", /^bpc_[A-Za-z0-9]{1,128}$/);
ok.push("Stripe Tax intentionally not activated. Independent tax obligations remain the merchant responsibility.");
flagged("SNOOZER_PREMIUM_LEGAL_CONFIRMED");
flagged("SNOOZER_PREMIUM_LIVE_ENABLED");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

const catalogue = [];
if (!url || !service) blockers.push("Hosted Supabase service credentials are required for this operator preflight.");
else {
  try {
    const supabase = createClient(url, service, { auth: { persistSession: false } });
    const [policy, prices] = await Promise.all([
      supabase.rpc("premium_live_preflight"),
      supabase.rpc("list_premium_live_catalogue"),
    ]);
    if (policy.error || prices.error || !policy.data || !Array.isArray(prices.data))
      blockers.push("Premium SQL migration or privileged RPC is missing.");
    else {
      const p = policy.data;
      for (const field of ["checkoutEnabled","legalReviewed"])
        if (p[field] !== true) blockers.push("Database " + field + " is not approved.");
      for (const row of prices.data) catalogue.push(row);
      for (const plan of ["plus","pro","studio"])
        for (const interval of ["month","year"])
          if (!catalogue.some(p => p.plan === plan && p.billing_interval === interval))
            blockers.push("No approved live " + plan + " / " + interval + " price.");
      ok.push("Existing live customer records: " + Number(p.customers));
      ok.push("Existing subscribed accounts: " + Number(p.currentSubscriptions));
      if (Number(p.unprocessedReceipts) > 0) blockers.push("Unprocessed live Stripe event receipts require reconciliation.");
    }
  } catch { blockers.push("Live Supabase preflight query failed."); }
}

if (key && account) {
  const stripe = new Stripe(key, { timeout: 8000, maxNetworkRetries: 0 });
  try {
    const own = await stripe.accounts.retrieve(account);
    if (own.id !== account || !own.charges_enabled || !own.payouts_enabled || !own.details_submitted)
      blockers.push("Stripe live account identity, payments or payouts do not match.");
    else ok.push("Verified LIVE Stripe merchant account and payouts.");
  } catch { blockers.push("Could not verify merchant account with the intended LIVE API key."); }
  if (portalId) {
    try {
      const portal = await stripe.billingPortal.configurations.retrieve(portalId);
      if (!portal.livemode || !portal.active
        || !portal.features.subscription_cancel.enabled
        || !portal.features.invoice_history.enabled
        || !portal.features.payment_method_update.enabled)
        blockers.push("Production Billing Portal is not active for cancellation, invoices and payment updates.");
      else ok.push("Live Billing Portal is configured.");
    } catch { blockers.push("Could not read production Billing Portal."); }
  }
  for (const price of catalogue) {
    try {
      const livePrice = await stripe.prices.retrieve(price.price_id);
      if (!livePrice.livemode || !livePrice.active || livePrice.currency !== "gbp"
        || livePrice.unit_amount !== price.unit_amount
        || livePrice.recurring?.interval !== price.billing_interval
        || livePrice.recurring.interval_count !== 1
        || livePrice.recurring.usage_type !== "licensed") {
        blockers.push("A live Price does not match the database-approved amount or billing interval.");
      }
    } catch { blockers.push("A database Price could not be read from the LIVE account."); }
  }
  try {
    const hooks = await stripe.webhookEndpoints.list({ limit: 100 });
    const webhook = hooks.data.find(x => x.url ===
      "https://snoozer-uk-staging.onrender.com/api/v1/billing/stripe/live-webhook"
      && !x.connect);
    if (!webhook || webhook.status !== "enabled") blockers.push("LIVE Premium webhook is not enabled.");
    else ok.push("Configured live-only Premium webhook endpoint found.");
  } catch { blockers.push("Unable to audit the live webhook with this API key; verify it in Stripe Workbench."); }
}
if (secret) ok.push("Separate webhook signing secret is present (signature delivery not yet proven).");

console.log("Snoozer Premium LIVE preflight (read-only)");
for (const good of ok) console.log("PASS: " + good);
for (const block of blockers) console.log("BLOCKED: " + block);
console.log("Required independent acceptance: signed test delivery, real subscription, renewal, failed payment, refund, cancellation, VAT/legal and email checks.");
if (blockers.length) process.exitCode = 1;
