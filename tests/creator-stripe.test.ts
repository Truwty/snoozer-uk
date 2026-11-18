import { afterEach, describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";
import type { CreatorMerchant } from "../src/lib/creator-merchant";
import { creatorAccountReady, creatorOnboardingUrl, creatorSandboxConfig, createCreatorSandboxAccount, readCreatorSandboxAccount } from "../src/lib/creator-stripe";

vi.mock("server-only", () => ({}));
afterEach(() => vi.unstubAllEnvs());
const merchant: CreatorMerchant = { id: "71ee2bc2-3003-48a3-a2f1-5145613293b3", platformId: "acct_Platform", accountId: "acct_Creator", country: "GB", createdAt: "2026-11-18T00:00:00Z", checkedAt: null, ready: false };
const account = { id: "acct_Creator", object: "v2.core.account", livemode: false, dashboard: "full", metadata: { snoozer_operation: merchant.id },
  defaults: { responsibilities: { fees_collector: "stripe", losses_collector: "stripe" } },
  configuration: { merchant: { capabilities: { card_payments: { status: "active" }, stripe_balance: { payouts: { status: "active" } } } } } };
const now = Date.parse("2026-11-18T12:00:00Z");
function provider(value: unknown = account) {
  const self = vi.fn().mockResolvedValue({ id: merchant.platformId });
  const create = vi.fn().mockResolvedValue(value);
  const retrieve = vi.fn().mockResolvedValue(value);
  const link = vi.fn().mockResolvedValue({ account: merchant.accountId, livemode: false, expires_at: new Date(now+300000).toISOString(), url: "https://connect.stripe.com/setup/test-fixture" });
  const stripe = { accounts: { retrieve: self }, v2: { core: { accounts: { create, retrieve }, accountLinks: { create: link } } } } as unknown as Stripe;
  return { stripe, self, create, retrieve, link };
}

describe("creator sandbox onboarding", () => {
  it("requires an explicit flag, pinned platform, service credential and test key", () => {
    vi.stubEnv("SNOOZER_CREATOR_SANDBOX_ENABLED", "false");
    vi.stubEnv("STRIPE_CREATOR_SANDBOX_PLATFORM_ID", merchant.platformId);
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "unit-fixture");
    vi.stubEnv("STRIPE_CREATOR_SANDBOX_API_KEY", ["rk", "test", "x".repeat(32)].join("_"));
    expect(creatorSandboxConfig()).toBeNull();
    vi.stubEnv("SNOOZER_CREATOR_SANDBOX_ENABLED", "true");
    expect(creatorSandboxConfig()?.platformId).toBe(merchant.platformId);
    vi.stubEnv("STRIPE_CREATOR_SANDBOX_API_KEY", ["rk", "live", "x".repeat(32)].join("_"));
    expect(creatorSandboxConfig()).toBeNull();
  });
  it("uses Accounts v2 explicit responsibilities and a stable operation key without transmitting identity details", async () => {
    const { stripe, create } = provider();
    await expect(createCreatorSandboxAccount(stripe, { ...merchant, accountId: null })).resolves.toBe(merchant.accountId);
    expect(create).toHaveBeenCalledWith({ dashboard: "full", identity: { country: "GB" }, defaults: { currency: "gbp", responsibilities: { fees_collector: "stripe", losses_collector: "stripe" } },
      configuration: { merchant: { capabilities: { card_payments: { requested: true } } } }, metadata: { snoozer_operation: merchant.id }, include: ["configuration.merchant", "defaults"] }, { idempotencyKey: "snoozer-creator-account-"+merchant.id });
    await expect(createCreatorSandboxAccount(stripe, merchant)).rejects.toThrow("already bound");
  });
  it("fails before creation when the current Stripe platform differs", async () => {
    const { stripe, self, create } = provider(); self.mockResolvedValue({ id: "acct_Other" });
    await expect(createCreatorSandboxAccount(stripe, { ...merchant, accountId: null })).rejects.toThrow("platform");
    expect(create).not.toHaveBeenCalled();
  });
  it.each([{ livemode: true }, { id: "acct_Other" }, { closed: true }, { dashboard: "none" }, { metadata: { snoozer_operation: "other" } },
    { defaults: { responsibilities: { fees_collector: "application", losses_collector: "application" } } }])("rejects account scope or responsibility mismatches %j", (change) => {
    expect(() => creatorAccountReady({ ...account, ...change }, merchant)).toThrow();
  });
  it("requires both current card and payout capabilities, never v1 booleans", async () => {
    expect(creatorAccountReady(account, merchant).ready).toBe(true);
    expect(creatorAccountReady({ ...account, charges_enabled: true, payouts_enabled: true, configuration: { merchant: { capabilities: { card_payments: { status: "inactive" } } } } }, merchant).ready).toBe(false);
    const { stripe, retrieve } = provider();
    await expect(readCreatorSandboxAccount(stripe, merchant)).resolves.toMatchObject({ ready: true });
    expect(retrieve).toHaveBeenCalledWith(merchant.accountId, { include: ["configuration.merchant", "defaults"] });
  });
  it("creates owner-bound single-use hosted onboarding links with fixed return/refresh routes", async () => {
    const { stripe, link } = provider();
    await expect(creatorOnboardingUrl(stripe, merchant, new URL("https://stage.example.com/"), now)).resolves.toBe("https://connect.stripe.com/setup/test-fixture");
    expect(link).toHaveBeenCalledWith({ account: merchant.accountId, use_case: { type: "account_onboarding", account_onboarding: { collection_options: { fields: "eventually_due" }, return_url: "https://stage.example.com/studio/products/seller?returned=1", refresh_url: "https://stage.example.com/studio/products/seller?expired=1" } } });
  });
  it.each([{ livemode: true }, { account: "acct_Other" }, { url: "https://connect.stripe.com.evil.example/setup/test" },
    { expires_at: "invalid" }, { expires_at: new Date(now-1).toISOString() }])("rejects unbound/live/expired or redirected onboarding URLs %j", async (change) => {
    const { stripe, link } = provider();link.mockResolvedValue({ ...(await link()), ...change });
    await expect(creatorOnboardingUrl(stripe, merchant, new URL("https://stage.example.com/"), now)).rejects.toThrow();
  });
});
