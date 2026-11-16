import Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";
import { receiveStripeWebhook } from "../src/lib/stripe-webhook";

const secret = "whsec_fixture_" + "a".repeat(32);
const event = {
  object: "event",
  id: "evt_TestReceipt",
  type: "checkout.session.completed",
  created: 1760000000,
  livemode: false,
  data: { object: { id: "cs_test_Example", customer_email: "private@example.com" } },
};

function signed(payload: string, timestamp?: number) {
  return Stripe.webhooks.generateTestHeaderString({ payload, secret, timestamp });
}

function request(payload: string, signature = signed(payload)) {
  return new Request("https://example.com/api/v1/billing/stripe/webhook", {
    method: "POST", body: payload, headers: { "stripe-signature": signature },
  });
}

describe("Stripe sandbox webhook intake", () => {
  it("authenticates the original bytes and waits for storage before acknowledging", async () => {
    const body = JSON.stringify(event, null, 2);
    const record = vi.fn().mockRejectedValueOnce(new Error("database unavailable")).mockResolvedValue(undefined);
    expect((await receiveStripeWebhook(request(body), secret, record)).status).toBe(503);
    expect((await receiveStripeWebhook(request(body), secret, record)).status).toBe(204);
    expect(record).toHaveBeenLastCalledWith({
      id: event.id, type: event.type, objectId: "cs_test_Example", occurredAt: "2025-10-09T08:53:20.000Z",
    });
  });

  it("rejects altered, stale, live and cross-account deliveries without writing", async () => {
    const body = JSON.stringify(event);
    const record = vi.fn();
    const requests = [
      request(body + " ", signed(body)),
      request(body, signed(body, Math.floor(Date.now() / 1000) - 301)),
      request(JSON.stringify({ ...event, livemode: true })),
      request(JSON.stringify({ ...event, account: "acct_Other" })),
      request(JSON.stringify({ ...event, data: { object: { id: "cs_live_Example" } } })),
    ];
    for (const incoming of requests) {
      expect((await receiveStripeWebhook(incoming, secret, record)).status).toBe(400);
    }
    expect(record).not.toHaveBeenCalled();
  });

  it("bounds the raw stream and ignores authentic events outside the subscribed set", async () => {
    const record = vi.fn();
    expect((await receiveStripeWebhook(request("x".repeat(256 * 1024 + 1)), secret, record)).status).toBe(413);
    const unsupported = JSON.stringify({ ...event, type: "customer.created", data: { object: { id: "cus_Example" } } });
    expect((await receiveStripeWebhook(request(unsupported), secret, record)).status).toBe(204);
    expect((await receiveStripeWebhook(request(unsupported), undefined, record)).status).toBe(503);
    expect(record).not.toHaveBeenCalled();
  });
});
