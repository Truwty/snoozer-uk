import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { premiumLiveReadConfig, premiumLiveWebhookConfig, premiumLiveCheckoutConfig, premiumLivePortalConfig } from "../src/lib/premium-live-config";

afterEach(() => vi.unstubAllEnvs());

function configure() {
  vi.stubEnv("STRIPE_PREMIUM_LIVE_API_KEY", ["rk", "live", "fixtureabc12345678901234567890"].join("_"));
  vi.stubEnv("STRIPE_PREMIUM_LIVE_ACCOUNT_ID", "acct_1SnoozerOnly");
  vi.stubEnv("STRIPE_PREMIUM_LIVE_WEBHOOK_SECRET", ["whsec", "fixtureabc12345678901234567890"].join("_"));
  vi.stubEnv("STRIPE_PREMIUM_LIVE_PORTAL_CONFIGURATION", "bpc_123456");
}

describe("Premium LIVE fail-closed activation", () => {
  it("requires a separate genuine LIVE key and exact platform account", () => {
    configure();
    expect(premiumLiveReadConfig()?.accountId).toBe("acct_1SnoozerOnly");
    vi.stubEnv("STRIPE_PREMIUM_LIVE_API_KEY", ["sk", "test", "fixtureabc12345678901234567890"].join("_"));
    expect(premiumLiveReadConfig()).toBeNull();
    vi.stubEnv("STRIPE_PREMIUM_LIVE_API_KEY", ["rk", "live", "fixtureabc12345678901234567890"].join("_"));
    vi.stubEnv("STRIPE_PREMIUM_LIVE_ACCOUNT_ID", "not-an-account");
    expect(premiumLiveReadConfig()).toBeNull();
  });
  it("requires independent live signing and legal, tax and checkout launch gates", () => {
    configure();
    expect(premiumLiveWebhookConfig()).not.toBeNull();
    expect(premiumLiveCheckoutConfig()).toBeNull();
    vi.stubEnv("SNOOZER_PREMIUM_LIVE_ENABLED", "true");
    expect(premiumLiveCheckoutConfig()).toBeNull();
    vi.stubEnv("SNOOZER_PREMIUM_TAX_CONFIRMED", "true");
    expect(premiumLiveCheckoutConfig()).toBeNull();
    vi.stubEnv("SNOOZER_PREMIUM_LEGAL_CONFIRMED", "true");
    expect(premiumLiveCheckoutConfig()).not.toBeNull();
    // Tax is an independent obligation, not an API activation switch.
    vi.stubEnv("SNOOZER_PREMIUM_TAX_CONFIRMED", "false");
    expect(premiumLiveCheckoutConfig()).not.toBeNull();
    vi.stubEnv("STRIPE_PREMIUM_LIVE_WEBHOOK_SECRET", "whsec_invalid");
    expect(premiumLiveCheckoutConfig()).toBeNull();
  });
  it("customer self-service is independent of Checkout being enabled", () => {
    configure();
    expect(premiumLiveCheckoutConfig()).toBeNull();
    expect(premiumLivePortalConfig()?.portalId).toBe("bpc_123456");
  });
});
