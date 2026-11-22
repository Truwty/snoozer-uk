import { beforeEach, describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";

vi.mock("server-only", () => ({}));

const calls = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../src/lib/supabase", () => ({ storageAdmin: () => ({ rpc: calls.rpc }) }));
import { reconcilePremiumLiveSubscription } from "../src/lib/premium-live-reconciliation";

const owner = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const subscription = {
  id: "sub_fixture", object: "subscription", livemode: true, customer: "cus_fixture",
  status: "active", pause_collection: null, cancel_at: null, latest_invoice: "in_fixture",
  items: { has_more: false, data: [{
    id: "si_fixture", quantity: 1,
    price: { id: "price_fixture", active: true, currency: "gbp", unit_amount: 300,
      recurring: { interval: "month", interval_count: 1 } },
    current_period_start: 1795000000, current_period_end: 1797600000,
  }] },
};
const invoice = { id: "in_fixture", object: "invoice", livemode: true,
  customer: "cus_fixture", currency: "gbp", status: "paid", amount_paid: 300,
  parent: { subscription_details: { subscription: "sub_fixture" } },
};
const stripe = {
  subscriptions: { retrieve: vi.fn() },
  invoices: { retrieve: vi.fn() },
  invoicePayments: { list: vi.fn() },
  paymentIntents: { retrieve: vi.fn() },
  charges: { retrieve: vi.fn() },
  disputes: { list: vi.fn() },
  radar: { earlyFraudWarnings: { list: vi.fn() } },
} as unknown as Stripe;

function lastApplied() {
  const call = calls.rpc.mock.calls.find(([method]) => method === "apply_premium_live_reconciliation");
  return call?.[1] as Record<string, unknown> | undefined;
}

beforeEach(() => {
  vi.clearAllMocks();
  calls.rpc.mockImplementation((method: string) => {
    if (method === "start_premium_live_reconciliation") return {
      maybeSingle: async () => ({ error: null, data: {
        owner_id: owner, customer_id: "cus_fixture", price_id: "price_fixture", revision: 1,
      } }),
    };
    return Promise.resolve({ data: true, error: null });
  });
  (stripe.subscriptions.retrieve as ReturnType<typeof vi.fn>).mockResolvedValue(subscription);
  (stripe.invoices.retrieve as ReturnType<typeof vi.fn>).mockResolvedValue(invoice);
  (stripe.invoicePayments.list as ReturnType<typeof vi.fn>).mockResolvedValue({
    has_more: false, data: [{ livemode: true, status: "paid",
      payment: { type: "payment_intent", payment_intent: "pi_fixture" } }],
  });
  (stripe.paymentIntents.retrieve as ReturnType<typeof vi.fn>).mockResolvedValue({
    id: "pi_fixture", livemode: true, status: "succeeded",
    customer: "cus_fixture", latest_charge: "ch_fixture",
  });
  (stripe.charges.retrieve as ReturnType<typeof vi.fn>).mockResolvedValue({
    id: "ch_fixture", livemode: true, status: "succeeded", paid: true,
    captured: true, customer: "cus_fixture", payment_intent: "pi_fixture",
    amount_refunded: 0, refunded: false, disputed: false,
    fraud_details: {}, outcome: { risk_level: "normal" },
  });
  (stripe.disputes.list as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [] });
  (stripe.radar.earlyFraudWarnings.list as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [] });
});

describe("Premium subscription reconciliation requires verified provider proof", () => {
  it("passes verified payment proof for a paid active subscription", async () => {
    expect(await reconcilePremiumLiveSubscription(stripe, "sub_fixture")).toBe(true);
    expect(lastApplied()).toEqual(expect.objectContaining({
      p_subscription: "sub_fixture", p_customer: "cus_fixture",
      p_price: "price_fixture", p_invoice: "in_fixture",
      p_stripe_status: "active", p_verified_paid: true, p_revision: 1,
    }));
  });

  it("does not grant paid access for a failed/unpaid invoice", async () => {
    (stripe.invoices.retrieve as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...invoice, status: "open", amount_paid: 0,
    });
    await reconcilePremiumLiveSubscription(stripe, "sub_fixture");
    expect(lastApplied()?.p_verified_paid).toBe(false);
    expect(stripe.invoicePayments.list).not.toHaveBeenCalled();
  });

  it("does not grant access for cancelled/past-due subscriptions", async () => {
    (stripe.subscriptions.retrieve as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...subscription, status: "past_due",
    });
    await reconcilePremiumLiveSubscription(stripe, "sub_fixture");
    expect(lastApplied()?.p_stripe_status).toBe("past_due");
    expect(lastApplied()?.p_verified_paid).toBe(false);
    expect(stripe.invoices.retrieve).not.toHaveBeenCalled();
  });

  it("places a risk hold and denies proof when the charge is refunded", async () => {
    (stripe.charges.retrieve as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "ch_fixture", livemode: true, status: "succeeded", paid: true,
      captured: true, customer: "cus_fixture", payment_intent: "pi_fixture",
      amount_refunded: 300, refunded: true, disputed: false,
    });
    await reconcilePremiumLiveSubscription(stripe, "sub_fixture");
    expect(calls.rpc).toHaveBeenCalledWith("hold_premium_live_invoice", {
      p_subscription: "sub_fixture", p_customer: "cus_fixture",
      p_invoice: "in_fixture", p_reason: "refund", p_event: null,
    });
    expect(lastApplied()?.p_verified_paid).toBe(false);
  });

  it("rejects a forged foreign customer without changing entitlements", async () => {
    (stripe.subscriptions.retrieve as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...subscription, customer: "cus_foreign",
    });
    await expect(reconcilePremiumLiveSubscription(stripe, "sub_fixture")).rejects.toThrow();
    expect(lastApplied()).toBeUndefined();
  });

  it("does not acknowledge a rejected revision update", async () => {
    calls.rpc.mockImplementation((method: string) => {
      if (method === "start_premium_live_reconciliation") return {
        maybeSingle: async () => ({ error: null, data: {
          owner_id: owner, customer_id: "cus_fixture", price_id: "price_fixture", revision: 1,
        } }),
      };
      return Promise.resolve({ data: false, error: null });
    });
    await expect(reconcilePremiumLiveSubscription(stripe, "sub_fixture")).rejects.toThrow("retried");
  });

  it("ignores subscription notifications until Checkout has been bound", async () => {
    calls.rpc.mockImplementation((method: string) => method === "start_premium_live_reconciliation"
      ? { maybeSingle: async () => ({ data: null, error: null }) }
      : Promise.resolve({ data: true, error: null }));
    expect(await reconcilePremiumLiveSubscription(stripe, "sub_fixture")).toBe(false);
    expect(stripe.subscriptions.retrieve).not.toHaveBeenCalled();
  });
});
