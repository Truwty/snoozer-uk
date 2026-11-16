import type Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";
import { fulfillSandboxGift } from "../src/lib/stripe-sandbox-paid-gift";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase", () => ({ storageAdmin: () => ({ rpc }) }));

const order = {
  order_id: "00000000-0000-4000-8000-000000000001", buyer_id: "00000000-0000-4000-8000-000000000002",
  stripe_price: "price_Gift", amount_pence: 399,
};
const receipt = { id: "evt_Gift", type: "checkout.session.completed", objectId: "cs_test_Gift", occurredAt: "2026-11-16T17:30:00Z" };
const secret = "a1".repeat(32);
const charge = { livemode: false, paid: true, captured: true, payment_intent: "pi_Gift", amount_refunded: 0, disputed: false };
const session = {
  id: receipt.objectId, client_reference_id: order.buyer_id, livemode: false, mode: "payment",
  metadata: { snoozer_gift_order: order.order_id }, status: "complete", payment_status: "paid",
  currency: "gbp", amount_total: 399,
  payment_intent: { id: "pi_Gift", livemode: false, status: "succeeded", currency: "gbp", amount_received: 399, latest_charge: charge },
};

function mockStripe(value = session, price = order.stripe_price) {
  rpc.mockReset().mockReturnValueOnce({ maybeSingle: async () => ({ data: order, error: null }) })
    .mockResolvedValueOnce({ data: "fulfilled", error: null });
  return { checkout: { sessions: {
    retrieve: vi.fn().mockResolvedValue(value),
    listLineItems: vi.fn().mockResolvedValue({ has_more: false, data: [{ price: { id: price }, quantity: 1 }] }),
  } } } as unknown as Stripe;
}

describe("paid Stripe sandbox gifts", () => {
  it("passes only a hash to the atomic fulfillment RPC after verifying payment and line items", async () => {
    await fulfillSandboxGift(mockStripe(), receipt, secret);
    expect(rpc).toHaveBeenLastCalledWith("fulfill_stripe_sandbox_gift", expect.objectContaining({
      p_event: receipt.id, p_order: order.order_id, p_payment: "pi_Gift", p_amount: 399,
      p_code_hash: expect.stringMatching(/^\\x[a-f0-9]{64}$/),
    }));
  });

  it("defers unpaid or refunded sessions and rejects a substituted price", async () => {
    await fulfillSandboxGift(mockStripe({ ...session, payment_status: "unpaid" }), receipt, secret);
    expect(rpc).toHaveBeenCalledTimes(1);
    await fulfillSandboxGift(mockStripe({
      ...session, payment_intent: { ...session.payment_intent, latest_charge: { ...charge, amount_refunded: 1 } },
    }), receipt, secret);
    expect(rpc).toHaveBeenCalledTimes(1);
    await expect(fulfillSandboxGift(mockStripe(session, "price_Other"), receipt, secret)).rejects.toThrow("line item");
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});
