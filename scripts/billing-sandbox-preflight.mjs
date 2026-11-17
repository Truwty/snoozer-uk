import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

const [provider = "all", ...extra] = process.argv.slice(2);
if (!["all", "stripe", "kofi"].includes(provider) || extra.length) {
  console.error("Usage: npm run billing:preflight -- [all|stripe|kofi]");
  process.exit(1);
}
const checkStripe = provider !== "kofi";
const checkKofi = provider !== "stripe";
const checks = [
  ["NEXT_PUBLIC_SITE_URL", (value) => {
    try {
      const url = new URL(value);
      return !url.username && !url.password && value === url.origin
        && (url.protocol === "https:" || (url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)));
    } catch { return false; }
  }],
  ["NEXT_PUBLIC_SUPABASE_URL", (value) => {
    try {
      const url = new URL(value);
      return !url.username && !url.password && !url.search && !url.hash && url.pathname === "/"
        && (url.protocol === "https:" || (url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)));
    } catch { return false; }
  }],
  ["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", Boolean],
  ["SUPABASE_SERVICE_ROLE_KEY", Boolean],
  ...(checkStripe ? [
    ["STRIPE_SANDBOX_API_KEY", (value) => /^(rk|sk)_test_[A-Za-z0-9]+$/.test(value)],
    ["STRIPE_SANDBOX_WEBHOOK_SECRET", (value) => /^whsec_\S+$/.test(value)],
    ["STRIPE_SANDBOX_GRANTS_ENABLED", (value) => value === "true"],
    ["STRIPE_SANDBOX_PORTAL_CONFIGURATION", (value) => /^bpc_[A-Za-z0-9]+$/.test(value)],
    ["STRIPE_SANDBOX_GIFT_KEY", (value) => /^[a-f0-9]{64}$/i.test(value)],
  ] : []),
  ...(checkKofi ? [["KOFI_WEBHOOK_TOKEN", Boolean]] : []),
];

const invalid = checks.filter(([name, validate]) => !validate(process.env[name]?.trim() ?? "")).map(([name]) => name);
if (invalid.length) {
  console.error("Configure the following values for the isolated provider test environment:");
  for (const name of invalid) console.error("- " + name);
  process.exit(1);
}

const database = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(8000), redirect: "error" }) },
});
async function catalogueMatches(stripe) {
  const { data, error } = await database.rpc("list_stripe_sandbox_preflight_offers");
  if (error || !Array.isArray(data)) return false;
  if (!data.some(({ billing_interval }) => billing_interval === null)
    || !data.some(({ billing_interval }) => billing_interval !== null)) return false;
  // Verify configured offers sequentially to avoid a burst against the sandbox API.
  for (const { price_id, amount_pence, billing_interval } of data) {
    const price = await stripe.prices.retrieve(price_id);
    if (price.livemode || !price.active || price.currency !== "gbp" || price.unit_amount !== amount_pence) return false;
    if (billing_interval === null ? price.type !== "one_time" :
      price.recurring?.interval !== billing_interval || price.recurring.interval_count !== 1
      || price.recurring.usage_type !== "licensed") return false;
  }
  return true;
}

const expectations = [
  ["Supabase service credential and billing diagnostics",
    database.rpc("get_billing_diagnostics").then(({ data, error }) => !error
      && (!checkStripe || Boolean(data?.stripeSandbox)) && (!checkKofi || Boolean(data?.kofi)))],
];
if (checkStripe) {
  const stripe = new Stripe(process.env.STRIPE_SANDBOX_API_KEY, { timeout: 8000, maxNetworkRetries: 0 });
  expectations.push(
    ["Active Snoozer subscription and gift prices match the Stripe sandbox", catalogueMatches(stripe)],
    ["Active sandbox Billing Portal with invoice history, payment updates and cancellation",
      stripe.billingPortal.configurations.retrieve(process.env.STRIPE_SANDBOX_PORTAL_CONFIGURATION)
        .then(({ active, livemode, features }) => active && !livemode && features.invoice_history.enabled
          && features.payment_method_update.enabled && features.subscription_cancel.enabled
          && !features.subscription_update.enabled)],
  );
}
const probes = await Promise.allSettled(expectations.map(([, probe]) => probe));
for (const [index, probe] of probes.entries()) {
  const passed = probe.status === "fulfilled" && probe.value === true;
  console.log((passed ? "PASS " : "FAIL ") + expectations[index][0]);
  if (!passed) process.exitCode = 1;
}
if (!process.exitCode) console.log("Run the provider journeys to verify webhook delivery, fulfillment and plan access.");
