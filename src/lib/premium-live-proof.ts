import { z } from "zod";

const id = (prefix: string) => z.string().regex(new RegExp("^" + prefix + "[A-Za-z0-9]{1,128}$"));
const seconds = z.number().int().positive().max(253402300799);
const statuses = z.enum(["active", "trialing", "canceled", "incomplete", "incomplete_expired", "past_due", "paused", "unpaid"]);

export const premiumPlan = z.enum(["plus", "pro", "studio"]);
export const premiumInterval = z.enum(["month", "year"]);
export const premiumPriceId = id("price_");
export const premiumCustomerId = id("cus_");
export const premiumSessionId = id("cs_live_");
export const premiumSubscriptionId = id("sub_");
export const premiumInvoiceId = id("in_");

export const premiumLiveOffer = z.object({
  price_id: premiumPriceId,
  plan: premiumPlan,
  plan_version: z.number().int().positive(),
  billing_interval: premiumInterval,
  currency: z.literal("gbp"),
  unit_amount: z.number().int().min(50).max(100000),
});

export const premiumAttempt = z.object({
  id: z.uuid(), priceId: premiumPriceId, amount: z.number().int().positive(),
  interval: premiumInterval,
  customerId: premiumCustomerId.nullable(), sessionId: premiumSessionId.nullable(),
  expires: seconds,
});

export function verifyLiveCheckoutSession(value: unknown, owner: string, customer: string, sessionId?: string) {
  const session = z.object({
    id: premiumSessionId,
    object: z.literal("checkout.session"),
    livemode: z.literal(true),
    mode: z.literal("subscription"),
    customer: z.literal(customer),
    client_reference_id: z.literal(owner),
    status: z.enum(["open", "complete", "expired"]),
    payment_status: z.enum(["paid", "unpaid", "no_payment_required"]),
    subscription: premiumSubscriptionId.nullable(),
    url: z.string().nullable(),
  }).parse(value);
  if (sessionId && session.id !== sessionId) throw new Error("Checkout identity mismatch.");
  return session;
}

export function verifyLiveSubscription(value: unknown, customer: string) {
  const subscription = z.object({
    id: premiumSubscriptionId,
    object: z.literal("subscription"),
    livemode: z.literal(true),
    customer: z.literal(customer),
    status: statuses,
    pause_collection: z.unknown().nullable(),
    cancel_at: seconds.nullable(),
    latest_invoice: z.union([premiumInvoiceId,z.object({ id: premiumInvoiceId })]).nullable(),
    items: z.object({
      has_more: z.literal(false),
      data: z.array(z.object({
        id: id("si_"),
        quantity: z.literal(1),
        price: z.object({
          id: premiumPriceId,
          active: z.boolean(),
          currency: z.literal("gbp"),
          unit_amount: z.number().int().min(50).max(100000),
          recurring: z.object({ interval: premiumInterval, interval_count: z.literal(1) }),
        }),
        current_period_start: seconds,
        current_period_end: seconds,
      })).length(1),
    }),
  }).parse(value);
  const item = subscription.items.data[0];
  if (item.current_period_end <= item.current_period_start
    || item.current_period_end - item.current_period_start > 370 * 86400)
    throw new Error("Invalid subscription period.");
  const invoiceId = typeof subscription.latest_invoice === "string"
    ? subscription.latest_invoice : subscription.latest_invoice?.id ?? null;
  const end = Math.min(item.current_period_end,subscription.cancel_at ?? item.current_period_end);
  return {
    id: subscription.id, customer: subscription.customer, status: subscription.status,
    eligibleStatus: subscription.status === "active" && subscription.pause_collection === null,
    invoiceId, priceId: item.price.id, amount: item.price.unit_amount,
    interval: item.price.recurring.interval,
    starts: new Date(item.current_period_start * 1000).toISOString(),
    ends: new Date(end * 1000).toISOString(),
  };
}

export function verifyLiveInvoice(value: unknown, subscriptionId: string, customerId: string, minAmount: number) {
  const invoice = z.object({
    id: premiumInvoiceId, object: z.literal("invoice"), livemode: z.literal(true),
    customer: z.literal(customerId), currency: z.literal("gbp"),
    status: z.enum(["draft","open","paid","uncollectible","void"]),
    amount_paid: z.number().int().nonnegative(),
    parent: z.object({ subscription_details: z.object({ subscription: premiumSubscriptionId }) }).nullable(),
  }).parse(value);
  if (invoice.parent?.subscription_details.subscription !== subscriptionId) throw new Error("Invoice subscription mismatch.");
  return { id: invoice.id, paid: invoice.status === "paid" && invoice.amount_paid >= minAmount };
}

export function verifiedLiveStripeUrl(value: string, host: "checkout.stripe.com" | "billing.stripe.com") {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.host !== host || url.username || url.password)
    throw new Error("Unsafe Stripe redirect.");
  return url.href;
}
