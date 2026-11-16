import type Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";
import { createSandboxPortalUrl } from "../src/lib/stripe-sandbox-portal";

vi.mock("server-only", () => ({}));

const customer = "cus_Owner";
const configuration = "bpc_Sandbox";
const site = new URL("https://stage.example.com/");
const session = { customer, configuration, livemode: false, url: "https://billing.stripe.com/p/session/sample" };

function stripeReturning(value: typeof session) {
  const create = vi.fn().mockResolvedValue(value);
  return { create, stripe: { billingPortal: { sessions: { create } } } as unknown as Stripe };
}

describe("Stripe sandbox portal", () => {
  it("creates a session for the mapped customer with a fixed return path", async () => {
    const { stripe, create } = stripeReturning(session);
    await expect(createSandboxPortalUrl(stripe, customer, configuration, site)).resolves.toBe(session.url);
    expect(create).toHaveBeenCalledWith({
      customer, configuration, return_url: "https://stage.example.com/studio/plan",
    });
  });

  it.each([
    { livemode: true }, { customer: "cus_Other" }, { configuration: "bpc_Other" },
    { url: "https://billing.stripe.com.example.com/p/session/sample" },
  ])("rejects an unexpected Stripe response %j", async (change) => {
    const { stripe } = stripeReturning({ ...session, ...change });
    await expect(createSandboxPortalUrl(stripe, customer, configuration, site)).rejects.toThrow("Unexpected");
  });
});
