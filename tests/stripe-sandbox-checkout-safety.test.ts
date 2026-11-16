import type Stripe from "stripe";
import { afterEach, expect, it, vi } from "vitest";
import { sandboxCheckoutKey } from "../src/lib/stripe-sandbox-checkout-config";
import { processStripeSandboxReceipt } from "../src/lib/stripe-sandbox-receipt";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase", () => ({ storageAdmin: () => ({ rpc }) }));
afterEach(() => vi.unstubAllEnvs());

it("only opens sandbox Checkout when plan grants are enabled", () => {
  vi.stubEnv("STRIPE_SANDBOX_API_KEY", "rk_test_fixture");
  vi.stubEnv("STRIPE_SANDBOX_WEBHOOK_SECRET", "whsec_fixture");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-only");
  vi.stubEnv("STRIPE_SANDBOX_GRANTS_ENABLED", "false");
  expect(sandboxCheckoutKey()).toBeUndefined();
  vi.stubEnv("STRIPE_SANDBOX_GRANTS_ENABLED", "true");
  expect(sandboxCheckoutKey()).toBe("rk_test_fixture");
});

it("records an expired sandbox gift without asking Stripe to retry a subscription change", async () => {
  rpc.mockResolvedValue({ error: null });
  const receipt = { id: "evt_Expiry", objectId: "cs_test_Expiry", type: "checkout.session.expired", occurredAt: "2026-11-16T18:00:00Z" };
  const retrieve = vi.fn().mockResolvedValue({ id: receipt.objectId, livemode: false, mode: "payment", status: "expired" });
  await processStripeSandboxReceipt(receipt, { checkout: { sessions: { retrieve } } } as unknown as Stripe);
  expect(rpc).toHaveBeenCalledExactlyOnceWith("record_stripe_sandbox_event", expect.objectContaining({ p_id: receipt.id }));
});
