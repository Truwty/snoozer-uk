import { boundedBody } from "./bounded-request";
import Stripe from "stripe";
import { z } from "zod";

const prefixes = {
  "checkout.session.completed": "cs_test_",
  "checkout.session.async_payment_succeeded": "cs_test_",
  "checkout.session.expired": "cs_test_",
  "customer.subscription.created": "sub_",
  "customer.subscription.updated": "sub_",
  "customer.subscription.deleted": "sub_",
  "invoice.paid": "in_",
  "invoice.payment_failed": "in_",
  "charge.refunded": "ch_",
  "charge.dispute.created": "dp_",
  "radar.early_fraud_warning.created": "issfr_",
} as const;

const snapshot = z.object({
  object: z.literal("event"),
  id: z.string().regex(/^evt_[A-Za-z0-9]{1,128}$/),
  type: z.string(),
  livemode: z.literal(false),
  account: z.null().optional(),
  context: z.null().optional(),
  created: z.number().int().positive().max(253402300799),
  data: z.object({ object: z.object({ id: z.string() }) }),
});

type Receipt = { id: string; type: string; objectId: string; occurredAt: string };
type RecordReceipt = (receipt: Receipt) => Promise<void>;

export async function receiveStripeWebhook(request: Request, secret: string | undefined, record: RecordReceipt) {
  if (!secret?.startsWith("whsec_")) return new Response(null, { status: 503 });
  const signature = request.headers.get("stripe-signature");
  if (!signature) return new Response(null, { status: 400 });
  let parsed;
  try {
    const body = await boundedBody(request, 256 * 1024);
    if (!body) return new Response(null, { status: 413 });
    parsed = snapshot.safeParse(Stripe.webhooks.constructEvent(body, signature, secret));
  } catch {
    return new Response(null, { status: 400 });
  }
  if (!parsed.success) return new Response(null, { status: 400 });

  const { id, type, created, data } = parsed.data;
  if (!Object.hasOwn(prefixes, type)) return new Response(null, { status: 204 });
  const prefix = prefixes[type as keyof typeof prefixes];
  const objectId = data.object.id;
  if (!objectId.startsWith(prefix) || !/^[A-Za-z0-9]{1,128}$/.test(objectId.slice(prefix.length))) {
    return new Response(null, { status: 400 });
  }

  try {
    await record({ id, type, objectId, occurredAt: new Date(created * 1000).toISOString() });
  } catch {
    return new Response(null, { status: 503 });
  }
  return new Response(null, { status: 204 });
}
