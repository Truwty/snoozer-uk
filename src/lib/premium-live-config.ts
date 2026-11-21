import "server-only";
import { z } from "zod";

// No Stripe Connect. Never fall back from a missing LIVE key to a sandbox key.
// Deliberately requires separate server and database review gates.
const stripeAccount = z.string().regex(/^acct_[A-Za-z0-9]{1,128}$/);
const liveKey = z.string().regex(/^(sk|rk)_live_[A-Za-z0-9_]{12,}$/);
const webhookSecret = z.string().regex(/^whsec_[A-Za-z0-9_]{20,512}$/);
const portalId = z.string().regex(/^bpc_[A-Za-z0-9]{1,128}$/);

export function premiumLiveReadConfig() {
  const key = liveKey.safeParse(process.env.STRIPE_PREMIUM_LIVE_API_KEY?.trim());
  const account = stripeAccount.safeParse(process.env.STRIPE_PREMIUM_LIVE_ACCOUNT_ID);
  if (!key.success || !account.success) return null;
  return { key: key.data, accountId: account.data };
}

export function premiumLiveWebhookConfig() {
  const provider = premiumLiveReadConfig();
  const secret = webhookSecret.safeParse(process.env.STRIPE_PREMIUM_LIVE_WEBHOOK_SECRET);
  return provider && secret.success ? { ...provider, secret: secret.data } : null;
}

export function premiumLiveCheckoutConfig() {
  const provider = premiumLiveWebhookConfig();
  return provider
    && process.env.SNOOZER_PREMIUM_LIVE_ENABLED === "true"
    && process.env.SNOOZER_PREMIUM_LEGAL_CONFIRMED === "true"
    ? provider : null;
}

export function premiumLivePortalConfig() {
  const provider = premiumLiveReadConfig();
  const portal = portalId.safeParse(process.env.STRIPE_PREMIUM_LIVE_PORTAL_CONFIGURATION);
  return provider && portal.success ? { ...provider, portalId: portal.data } : null;
}
