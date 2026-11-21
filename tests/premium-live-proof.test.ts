import { describe, expect, it } from "vitest";
import { verifyLiveCheckoutSession, verifyLiveSubscription, verifyLiveInvoice, verifiedLiveStripeUrl, premiumLiveOffer } from "../src/lib/premium-live-proof";

const session = {
  id: "cs_live_abcdef", object: "checkout.session", livemode: true,
  mode: "subscription", customer: "cus_abc", client_reference_id: "user-uuid",
  status: "complete", payment_status: "paid", subscription: "sub_abc", url: null,
};
const recurring = {
  id: "sub_abc", object: "subscription", livemode: true, customer: "cus_abc",
  status: "active", pause_collection: null, cancel_at: null,
  latest_invoice: "in_abc",
  items: { has_more: false, data: [{
    id: "si_abc", quantity: 1,
    price: { id: "price_abc", active: true, currency: "gbp", unit_amount: 399,
      recurring: { interval: "month", interval_count: 1 } },
    current_period_start: 1795000000, current_period_end: 1797600000,
  }] },
};
const invoice = {
  id: "in_abc", object: "invoice", livemode: true, customer: "cus_abc",
  currency: "gbp", status: "paid", amount_paid: 399,
  parent: { subscription_details: { subscription: "sub_abc" } },
};

describe("Snoozer Premium live provider proof", () => {
  it("accepts a genuinely bound LIVE Checkout and rejects foreign or test sessions", () => {
    expect(verifyLiveCheckoutSession(session, "user-uuid", "cus_abc").id).toBe("cs_live_abcdef");
    expect(() => verifyLiveCheckoutSession({ ...session, livemode: false }, "user-uuid", "cus_abc")).toThrow();
    expect(() => verifyLiveCheckoutSession({ ...session, client_reference_id: "other-user" }, "user-uuid", "cus_abc")).toThrow();
    expect(() => verifyLiveCheckoutSession({ ...session, customer: "cus_foreign" }, "user-uuid", "cus_abc")).toThrow();
    expect(() => verifyLiveCheckoutSession({ ...session, id: "cs_test_abc" }, "user-uuid", "cus_abc")).toThrow();
  });
  it("validates price, recurring interval and versioned plan metadata", () => {
    expect(premiumLiveOffer.parse({ price_id: "price_abc", plan: "plus", plan_version: 1,
      billing_interval: "month", currency: "gbp", unit_amount: 399 }).plan).toBe("plus");
    expect(() => premiumLiveOffer.parse({ price_id: "price_abc", plan: "free", plan_version: 1,
      billing_interval: "month", currency: "gbp", unit_amount: 0 })).toThrow();
  });
  it("requires current LIVE subscription and one billed quantity, without trials or pauses", () => {
    expect(verifyLiveSubscription(recurring, "cus_abc").eligibleStatus).toBe(true);
    expect(verifyLiveSubscription({ ...recurring, status: "trialing" }, "cus_abc").eligibleStatus).toBe(false);
    expect(verifyLiveSubscription({ ...recurring, pause_collection: {} }, "cus_abc").eligibleStatus).toBe(false);
    expect(() => verifyLiveSubscription({ ...recurring, livemode: false }, "cus_abc")).toThrow();
    expect(() => verifyLiveSubscription({ ...recurring, customer: "cus_other" }, "cus_abc")).toThrow();
    expect(() => verifyLiveSubscription({ ...recurring, items: { has_more: true, data: recurring.items.data } }, "cus_abc")).toThrow();
    expect(() => verifyLiveSubscription({ ...recurring, items: { has_more: false, data: [{ ...recurring.items.data[0], quantity: 2 }] } }, "cus_abc")).toThrow();
  });
  it("requires a fully-paid LIVE invoice from exactly the bound subscription/customer", () => {
    expect(verifyLiveInvoice(invoice, "sub_abc", "cus_abc", 399).paid).toBe(true);
    expect(verifyLiveInvoice({ ...invoice, status: "open" }, "sub_abc", "cus_abc", 399).paid).toBe(false);
    expect(verifyLiveInvoice({ ...invoice, amount_paid: 100 }, "sub_abc", "cus_abc", 399).paid).toBe(false);
    expect(() => verifyLiveInvoice({ ...invoice, livemode: false }, "sub_abc", "cus_abc", 399)).toThrow();
    expect(() => verifyLiveInvoice({ ...invoice, parent: { subscription_details: { subscription: "sub_other" } } }, "sub_abc", "cus_abc", 399)).toThrow();
  });
  it("permits only Stripe's exact HTTPS checkout and billing portal origins", () => {
    expect(verifiedLiveStripeUrl("https://checkout.stripe.com/c/test", "checkout.stripe.com")).toContain("https://checkout.stripe.com");
    expect(() => verifiedLiveStripeUrl("https://checkout.stripe.com.evil.example/p", "checkout.stripe.com")).toThrow();
    expect(() => verifiedLiveStripeUrl("https://evil.example@checkout.stripe.com/a", "checkout.stripe.com")).toThrow();
    expect(() => verifiedLiveStripeUrl("http://billing.stripe.com/a", "billing.stripe.com")).toThrow();
  });
});
