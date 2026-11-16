import "server-only";
import { createHash, createHmac } from "node:crypto";
import type Stripe from "stripe";
import { z } from "zod";
import { storageAdmin } from "@/lib/supabase";
import type { StripeReceipt } from "@/lib/stripe-webhook";

const orderShape = z.object({
  order_id: z.uuid(), buyer_id: z.uuid(), stripe_price: z.string(), amount_pence: z.number().int().positive(),
});

export function sandboxPaidGiftSecret() {
  const secret = process.env.STRIPE_SANDBOX_GIFT_KEY;
  return secret && /^[a-f0-9]{64}$/i.test(secret) ? secret : undefined;
}

export function sandboxPaidGiftConfiguration() {
  const key = process.env.STRIPE_SANDBOX_API_KEY;
  const giftSecret = sandboxPaidGiftSecret();
  if (key && /^(rk|sk)_test_/.test(key) && giftSecret && process.env.SUPABASE_SERVICE_ROLE_KEY
      && process.env.STRIPE_SANDBOX_GRANTS_ENABLED === "true"
      && process.env.STRIPE_SANDBOX_WEBHOOK_SECRET?.startsWith("whsec_")) return { key, giftSecret };
  return null;
}

export function paidGiftCode(orderId: string, secret: string) {
  return createHmac("sha256", Buffer.from(secret, "hex"))
    .update("snoozer-stripe-sandbox-gift:" + orderId).digest("hex").slice(0, 32);
}

export async function fulfillSandboxGift(stripe: Stripe, receipt: StripeReceipt, secret: string) {
  const admin = storageAdmin();
  const { data, error } = await admin.rpc("find_stripe_sandbox_gift_order", { p_session: receipt.objectId }).maybeSingle();
  if (error) throw new Error("Gift order lookup failed.");
  if (!data) return;

  const order = orderShape.parse(data);
  const session = await stripe.checkout.sessions.retrieve(receipt.objectId, { expand: ["payment_intent.latest_charge"] });
  if (session.id !== receipt.objectId || session.livemode || session.mode !== "payment"
      || session.client_reference_id !== order.buyer_id || session.metadata?.snoozer_gift_order !== order.order_id) {
    throw new Error("Stripe gift session does not match its order.");
  }
  if (session.status !== "complete" || session.payment_status !== "paid") return;

  const intent = session.payment_intent;
  if (typeof intent !== "object" || !intent || intent.livemode || intent.status !== "succeeded"
      || intent.currency !== "gbp" || intent.amount_received !== order.amount_pence
      || session.currency !== "gbp" || session.amount_total !== order.amount_pence) {
    throw new Error("Stripe gift payment does not match the offer.");
  }
  const charge = intent.latest_charge;
  if (typeof charge !== "object" || !charge || charge.livemode || !charge.paid || !charge.captured
      || charge.payment_intent !== intent.id) throw new Error("Stripe gift charge is unavailable.");
  if (charge.amount_refunded > 0) return;
  if (charge.disputed) {
    const disputes = await stripe.disputes.list({ charge: charge.id, limit: 10 });
    if (disputes.has_more || !disputes.data.length
        || disputes.data.some((dispute) => dispute.livemode || dispute.status !== "won")) return;
  }

  const lines = await stripe.checkout.sessions.listLineItems(session.id, { limit: 2 });
  const [line] = lines.data;
  if (lines.has_more || lines.data.length !== 1 || line.price?.id !== order.stripe_price || line.quantity !== 1) {
    throw new Error("Stripe gift line item does not match the offer.");
  }

  const codeHash = createHash("sha256").update(paidGiftCode(order.order_id, secret)).digest("hex");
  const saved = await admin.rpc("fulfill_stripe_sandbox_gift", {
    p_event: receipt.id, p_buyer: order.buyer_id, p_order: order.order_id, p_session: session.id,
    p_payment: intent.id, p_price: order.stripe_price, p_amount: order.amount_pence,
    p_code_hash: "\\x" + codeHash,
  });
  if (saved.error || (saved.data !== "fulfilled" && saved.data !== "held")) {
    throw new Error("Stripe gift fulfillment could not be saved.");
  }
}
