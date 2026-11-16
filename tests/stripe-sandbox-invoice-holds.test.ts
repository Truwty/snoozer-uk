import type Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";
import { recordSandboxInvoiceHolds } from "../src/lib/stripe-sandbox-invoice-holds";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase", () => ({ storageAdmin: () => ({ rpc }) }));

const event = { id: "evt_Risk", type: "charge.dispute.created", objectId: "dp_Risk" };
const invoice = {
  id: "in_Linked", livemode: false, customer: "cus_Owner",
  parent: { subscription_details: { subscription: "sub_Linked" } },
};

function provider() {
  rpc.mockReset().mockResolvedValue({ error: null });
  const list = vi.fn().mockReturnValue([
    { livemode: false, invoice: { ...invoice, id: "in_Other", customer: "cus_Other" } },
    { livemode: false, invoice },
  ]);
  const charge = { id: "ch_Linked", livemode: false, customer: "cus_Owner", payment_intent: "pi_Linked", amount_refunded: 0 };
  const retrieveCharge = vi.fn().mockResolvedValue(charge);
  const stripe = {
    disputes: { retrieve: vi.fn().mockResolvedValue({ id: event.objectId, livemode: false, charge: charge.id }) },
    charges: { retrieve: retrieveCharge }, invoicePayments: { list },
  } as unknown as Stripe;
  return { stripe, list, retrieveCharge, charge };
}

describe("Stripe sandbox invoice holds", () => {
  it("follows a dispute through its payment intent and records only matching invoices", async () => {
    const { stripe, list, retrieveCharge } = provider();
    await expect(recordSandboxInvoiceHolds(stripe, event)).resolves.toEqual(["sub_Linked"]);
    expect(retrieveCharge).toHaveBeenCalledWith("ch_Linked");
    expect(list).toHaveBeenCalledWith(expect.objectContaining({
      payment: { type: "payment_intent", payment_intent: "pi_Linked" },
    }));
    expect(rpc).toHaveBeenNthCalledWith(1, "hold_stripe_sandbox_gift_payment", {
      p_event: event.id, p_payment: "pi_Linked",
    });
    expect(rpc).toHaveBeenNthCalledWith(2, "record_stripe_sandbox_invoice_hold", {
      p_event: event.id, p_invoice: "in_Linked", p_subscription: "sub_Linked", p_customer: "cus_Owner",
    });
  });

  it("ignores a charge with no refund and retries failures to persist a hold", async () => {
    const { stripe, retrieveCharge, charge } = provider();
    const refund = { ...event, type: "charge.refunded", objectId: charge.id };
    await expect(recordSandboxInvoiceHolds(stripe, refund)).resolves.toEqual([]);
    expect(rpc).not.toHaveBeenCalled();
    retrieveCharge.mockResolvedValueOnce({ ...charge, amount_refunded: 100 });
    rpc.mockResolvedValueOnce({ error: { code: "unavailable" } });
    await expect(recordSandboxInvoiceHolds(stripe, refund)).rejects.toThrow("could not be saved");
  });
});
