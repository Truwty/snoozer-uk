import { beforeEach, describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";

vi.mock("server-only", () => ({}));

const calls = vi.hoisted(() => ({
  rpc: vi.fn(),
  reconcile: vi.fn(),
  hold: vi.fn(),
}));
vi.mock("../src/lib/supabase", () => ({ storageAdmin: () => ({ rpc: calls.rpc }) }));
vi.mock("../src/lib/premium-live-reconciliation", () => ({
  reconcilePremiumLiveSubscription: calls.reconcile,
  holdPremiumLiveRiskEvent: calls.hold,
}));

import { processPremiumLiveEvent } from "../src/lib/premium-live-webhook";

const event = (type: string, id: string) => ({
  id: "evt_example123", type, created: 1795000000, livemode: true,
  data: { object: { id } },
} as Stripe.Event);

const provider = {
  checkout: { sessions: { retrieve: vi.fn() } },
  invoices: { retrieve: vi.fn() },
} as unknown as Stripe;

beforeEach(() => {
  vi.clearAllMocks();
  calls.rpc.mockResolvedValue({ data: true, error: null });
  calls.reconcile.mockResolvedValue(true);
  calls.hold.mockResolvedValue(undefined);
});

describe("Premium live webhook processing is idempotent and fail-closed", () => {
  it("ignores unrelated events without writing payment receipts", async () => {
    await processPremiumLiveEvent(provider, event("customer.created", "cus_test"));
    expect(calls.rpc).not.toHaveBeenCalled();
  });

  it("records an event before reconciliation and marks it processed after success", async () => {
    await processPremiumLiveEvent(provider, event("customer.subscription.updated", "sub_123"));
    expect(calls.rpc).toHaveBeenCalledWith("record_premium_live_receipt", expect.objectContaining({
      p_id: "evt_example123", p_type: "customer.subscription.updated", p_object: "sub_123",
    }));
    expect(calls.reconcile).toHaveBeenCalledWith(provider, "sub_123");
    expect(calls.rpc).toHaveBeenCalledWith("finish_premium_live_receipt", { p_id: "evt_example123" });
    expect(calls.rpc.mock.invocationCallOrder[0]).toBeLessThan(calls.reconcile.mock.invocationCallOrder[0]);
    expect(calls.reconcile.mock.invocationCallOrder[0]).toBeLessThan(calls.rpc.mock.invocationCallOrder[1]);
  });

  it("skips a fully processed duplicate without reconciling twice", async () => {
    calls.rpc.mockResolvedValueOnce({ data: false, error: null });
    await processPremiumLiveEvent(provider, event("customer.subscription.deleted", "sub_123"));
    expect(calls.reconcile).not.toHaveBeenCalled();
    expect(calls.rpc).toHaveBeenCalledTimes(1);
  });

  it("never acknowledges events if the database receipt could not be stored", async () => {
    calls.rpc.mockResolvedValueOnce({ data: null, error: { message: "database unavailable" } });
    await expect(processPremiumLiveEvent(provider, event("customer.subscription.created", "sub_123"))).rejects.toThrow("receipt");
    expect(calls.reconcile).not.toHaveBeenCalled();
    expect(calls.rpc).toHaveBeenCalledTimes(1);
  });

  it("leaves a failed reconciliation pending for Stripe retry", async () => {
    calls.reconcile.mockRejectedValueOnce(new Error("Stripe request failed"));
    await expect(processPremiumLiveEvent(provider, event("customer.subscription.updated", "sub_123"))).rejects.toThrow("Stripe request failed");
    expect(calls.rpc).toHaveBeenCalledTimes(1);
  });

  it("routes invoice renewals and failures to subscription reconciliation", async () => {
    const invoice = { id: "in_123", livemode: true,
      parent: { subscription_details: { subscription: "sub_123" } } };
    (provider.invoices.retrieve as ReturnType<typeof vi.fn>).mockResolvedValue(invoice);
    await processPremiumLiveEvent(provider, event("invoice.paid", "in_123"));
    expect(calls.reconcile).toHaveBeenCalledWith(provider, "sub_123");
    await processPremiumLiveEvent(provider, event("invoice.payment_failed", "in_123"));
    expect(calls.reconcile).toHaveBeenCalledTimes(2);
  });

  it("does not bind unverified Checkout for another account", async () => {
    (provider.checkout.sessions.retrieve as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "cs_live_example", object: "checkout.session", livemode: true,
      mode: "subscription", status: "complete", payment_status: "paid",
      customer: "cus_123", client_reference_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      subscription: "sub_123", url: null,
    });
    calls.rpc.mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: false, error: null })
      .mockResolvedValueOnce({ data: true, error: null });
    await processPremiumLiveEvent(provider, event("checkout.session.completed", "cs_live_example"));
    expect(calls.rpc).toHaveBeenCalledWith("bind_premium_live_subscription", expect.anything());
    expect(calls.reconcile).not.toHaveBeenCalled();
    expect(calls.rpc).toHaveBeenCalledWith("finish_premium_live_receipt", { p_id: "evt_example123" });
  });

  it("retries a real Snoozer Checkout when Stripe races ahead of local session binding", async () => {
    const snoozerOwner = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    (provider.checkout.sessions.retrieve as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "cs_live_example", object: "checkout.session", livemode: true,
      mode: "subscription", status: "complete", payment_status: "paid",
      customer: "cus_123", client_reference_id: snoozerOwner,
      subscription: "sub_123", url: null,
      metadata: { snoozer_owner: snoozerOwner, snoozer_attempt: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" },
    });
    calls.rpc.mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: false, error: null });
    await expect(processPremiumLiveEvent(provider, event("checkout.session.completed", "cs_live_example")))
      .rejects.toThrow("retry");
    expect(calls.rpc).toHaveBeenCalledTimes(2);
    expect(calls.reconcile).not.toHaveBeenCalled();
    expect(calls.rpc).not.toHaveBeenCalledWith("finish_premium_live_receipt", expect.anything());
  });

  it("routes refund/dispute and fraud warnings to conservative risk handling", async () => {
    await processPremiumLiveEvent(provider, event("charge.refunded", "ch_123"));
    expect(calls.hold).toHaveBeenCalledWith(provider, {
      id: "evt_example123", type: "charge.refunded", objectId: "ch_123",
    });
  });

  it("rejects invalid event IDs without acknowledging them", async () => {
    await expect(processPremiumLiveEvent(provider, { ...event("invoice.paid", "in_123"), id: "invalid" })).rejects.toThrow();
    expect(calls.rpc).not.toHaveBeenCalled();
  });
});
