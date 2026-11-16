import "server-only";
import type Stripe from "stripe";

export function sandboxPortalConfiguration() {
  const key = process.env.STRIPE_SANDBOX_API_KEY;
  const configuration = process.env.STRIPE_SANDBOX_PORTAL_CONFIGURATION;
  if (!key || !/^(rk|sk)_test_/.test(key) || !configuration || !/^bpc_[A-Za-z0-9]+$/.test(configuration)) return null;
  return { key, configuration };
}

export async function createSandboxPortalUrl(
  stripe: Stripe, customer: string, configuration: string, site: URL,
) {
  if (!/^cus_[A-Za-z0-9]{1,128}$/.test(customer)) throw new Error("Invalid Stripe customer.");
  const session = await stripe.billingPortal.sessions.create({
    customer, configuration, return_url: new URL("/studio/plan", site).href,
  });
  const target = new URL(session.url);
  if (session.livemode || session.customer !== customer || session.configuration !== configuration
      || target.origin !== "https://billing.stripe.com" || target.username || target.password) {
    throw new Error("Unexpected Stripe portal session.");
  }
  return target.href;
}
