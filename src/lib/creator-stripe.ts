import "server-only";
import type Stripe from "stripe";
import { z } from "zod";
import { stripeAccountId, type CreatorMerchant } from "./creator-merchant";

export function creatorSandboxConfig() {
  const key = process.env.STRIPE_CREATOR_SANDBOX_API_KEY || process.env.STRIPE_SANDBOX_API_KEY;
  const platform = stripeAccountId.safeParse(process.env.STRIPE_CREATOR_SANDBOX_PLATFORM_ID);
  return process.env.SNOOZER_CREATOR_SANDBOX_ENABLED === "true" && process.env.SUPABASE_SERVICE_ROLE_KEY
    && key && /^(rk|sk)_test_/.test(key) && key.length <= 512 && !/\s/.test(key) && platform.success
    ? { key, platformId: platform.data } : null;
}

export async function assertCreatorPlatform(stripe: Stripe, platformId: string) {
  if (!stripeAccountId.safeParse(platformId).success || (await stripe.accounts.retrieve(null)).id !== platformId) throw new Error("Unexpected Stripe platform.");
}

export function creatorAccountReady(value: unknown, merchant: Pick<CreatorMerchant, "id" | "platformId" | "accountId">) {
  const account = z.object({ id: stripeAccountId, object: z.literal("v2.core.account"), livemode: z.literal(false), closed: z.boolean().optional(),
    dashboard: z.literal("full"), metadata: z.object({ snoozer_operation: z.literal(merchant.id) }),
    defaults: z.object({ responsibilities: z.object({ fees_collector: z.literal("stripe"), losses_collector: z.literal("stripe") }) }),
    configuration: z.object({ merchant: z.object({ capabilities: z.object({ card_payments: z.object({ status: z.string() }).optional(),
      stripe_balance: z.object({ payouts: z.object({ status: z.string() }).optional() }).optional() }).optional() }) }),
  }).parse(value);
  if (account.closed || account.id === merchant.platformId || (merchant.accountId && account.id !== merchant.accountId)) throw new Error("Unexpected connected account.");
  return { id: account.id, ready: account.configuration.merchant.capabilities?.card_payments?.status === "active"
    && account.configuration.merchant.capabilities.stripe_balance?.payouts?.status === "active" };
}

export async function createCreatorSandboxAccount(stripe: Stripe, merchant: CreatorMerchant) {
  if (merchant.accountId) throw new Error("Account is already bound.");
  await assertCreatorPlatform(stripe, merchant.platformId);
  const account = await stripe.v2.core.accounts.create({ dashboard: "full", identity: { country: merchant.country },
    defaults: { currency: "gbp", responsibilities: { fees_collector: "stripe", losses_collector: "stripe" } },
    configuration: { merchant: { capabilities: { card_payments: { requested: true } } } }, metadata: { snoozer_operation: merchant.id },
    include: ["configuration.merchant", "defaults"],
  }, { idempotencyKey: "snoozer-creator-account-" + merchant.id });
  return creatorAccountReady(account, merchant).id;
}

export async function readCreatorSandboxAccount(stripe: Stripe, merchant: CreatorMerchant) {
  if (!merchant.accountId) throw new Error("Account is not bound.");
  await assertCreatorPlatform(stripe, merchant.platformId);
  return creatorAccountReady(await stripe.v2.core.accounts.retrieve(merchant.accountId, { include: ["configuration.merchant", "defaults"] }), merchant);
}

export async function creatorOnboardingUrl(stripe: Stripe, merchant: CreatorMerchant, site: URL, now = Date.now()) {
  await readCreatorSandboxAccount(stripe, merchant);
  if (site.username || site.password || (site.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(site.hostname))) throw new Error("HTTPS is required.");
  const result = await stripe.v2.core.accountLinks.create({ account: merchant.accountId!, use_case: { type: "account_onboarding",
    account_onboarding: { collection_options: { fields: "eventually_due" }, return_url: new URL("/studio/products/seller?returned=1", site).href,
      refresh_url: new URL("/studio/products/seller?expired=1", site).href } } });
  const target = new URL(result.url);
  const expiry = Date.parse(result.expires_at);
  if (result.livemode || result.account !== merchant.accountId || target.origin !== "https://connect.stripe.com" || target.username || target.password
    || !target.pathname.startsWith("/setup/") || !Number.isFinite(expiry) || expiry <= now || expiry > now + 3600000) throw new Error("Unexpected onboarding link.");
  return target.href;
}
