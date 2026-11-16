import type Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";
import { reconcileSandboxSubscription } from "../src/lib/stripe-sandbox-reconciliation";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase", () => ({ storageAdmin: () => ({ rpc }) }));

const receipt = { type: "invoice.paid", objectId: "in_Delivery" };
const linkedInvoice = {
  id: receipt.objectId, livemode: false, status: "paid", customer: "cus_Owner",
  parent: { subscription_details: { subscription: "sub_Stored" } },
};

function configure(status: string, invoiceStatus: string, customer = "cus_Owner") {
  rpc.mockReset();
  rpc.mockReturnValueOnce({ maybeSingle: async () => ({
    data: { customer_id: "cus_Owner", price_id: "price_Stored", revision: 7 }, error: null,
  }) }).mockResolvedValueOnce({ data: true, error: null });
  const retrieve = vi.fn().mockResolvedValue({
    id: "sub_Stored", livemode: false, status, customer, pause_collection: null, cancel_at: 1797000000,
    items: { has_more: false, data: [{
      price: { id: "price_Stored" }, quantity: 1,
      current_period_start: 1794300000, current_period_end: 1797300000,
    }] },
    latest_invoice: { ...linkedInvoice, status: invoiceStatus },
  });
  const stripe = {
    invoices: { retrieve: vi.fn().mockResolvedValue(linkedInvoice) },
    subscriptions: { retrieve },
  } as unknown as Stripe;
  return { stripe, retrieve };
}

describe("Stripe sandbox subscription reconciliation", () => {
  it("uses the current paid invoice and caps access at scheduled cancellation", async () => {
    const { stripe, retrieve } = configure("active", "paid");
    await reconcileSandboxSubscription(stripe, receipt);
    expect(retrieve).toHaveBeenCalledWith("sub_Stored", { expand: ["latest_invoice"] });
    expect(rpc).toHaveBeenLastCalledWith("apply_stripe_sandbox_reconciliation", {
      p_subscription: "sub_Stored", p_customer: "cus_Owner", p_price: "price_Stored", p_revision: 7, p_invoice: linkedInvoice.id,
      p_starts: new Date(1794300000000).toISOString(), p_ends: new Date(1797000000000).toISOString(),
    });
  });

  it.each([["active", "open"], ["past_due", "paid"], ["trialing", "paid"]])(
    "does not extend access with status %s and invoice %s", async (status, invoiceStatus) => {
      const { stripe } = configure(status, invoiceStatus);
      await reconcileSandboxSubscription(stripe, receipt);
      expect(rpc).toHaveBeenLastCalledWith("apply_stripe_sandbox_reconciliation",
        expect.objectContaining({ p_starts: null, p_ends: null }));
    },
  );

  it.each(["canceled", "incomplete_expired"])("archives only terminal status %s", async (status) => {
    const { stripe } = configure(status, "paid");
    rpc.mockReset().mockReturnValueOnce({ maybeSingle: async () => ({
      data: { customer_id: "cus_Owner", price_id: "price_Stored", revision: 7 }, error: null,
    }) }).mockResolvedValueOnce({ data: "changed", error: null });
    await expect(reconcileSandboxSubscription(stripe, receipt)).resolves.toBe(true);
    expect(rpc).toHaveBeenLastCalledWith("end_stripe_sandbox_subscription", {
      p_subscription: "sub_Stored", p_customer: "cus_Owner", p_revision: 7, p_status: status,
    });
  });

  it("rejects a provider ownership mismatch without applying a grant update", async () => {
    const { stripe } = configure("active", "paid", "cus_Other");
    await expect(reconcileSandboxSubscription(stripe, receipt)).rejects.toThrow("ownership");
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});
