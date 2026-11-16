import "server-only";
import type Stripe from "stripe";
import { storageAdmin } from "@/lib/supabase";
import { recordSandboxInvoiceHolds } from "./stripe-sandbox-invoice-holds";
import { reconcileSandboxSubscription } from "./stripe-sandbox-reconciliation";
import { bindSubscriptionFromReceipt } from "./stripe-subscription-binding";
import { fulfillSandboxGift, sandboxPaidGiftSecret } from "./stripe-sandbox-paid-gift";
import type { StripeReceipt } from "./stripe-webhook";

export async function processStripeSandboxReceipt(receipt: StripeReceipt, stripe?: Stripe) {
  const { error } = await storageAdmin().rpc("record_stripe_sandbox_event", {
    p_id: receipt.id, p_type: receipt.type, p_object: receipt.objectId, p_occurred_at: receipt.occurredAt,
  });
  if (error) throw new Error("Stripe receipt could not be saved.");
  if (!stripe) return;
  if (receipt.type === "checkout.session.expired") {
    const session = await stripe.checkout.sessions.retrieve(receipt.objectId);
    if (session.livemode || session.id !== receipt.objectId || session.status !== "expired") {
      throw new Error("Stripe Checkout expiry could not be confirmed.");
    }
    // Gift orders have their own request IDs and require no subscription replacement.
    if (session.mode !== "subscription" || session.subscription !== null) return;
    if (typeof session.customer !== "string" || !session.client_reference_id) return;
    const expired = await storageAdmin().rpc("mark_stripe_sandbox_checkout_expired", {
      p_event: receipt.id, p_session: session.id, p_customer: session.customer, p_owner: session.client_reference_id,
    });
    if (expired.error) throw new Error("Stripe Checkout expiry could not be saved.");
    return;
  }

  const checkout = receipt.type === "checkout.session.completed"
    || receipt.type === "checkout.session.async_payment_succeeded";
  const subscription = checkout ? await bindSubscriptionFromReceipt(receipt.id, stripe) : undefined;
  if (process.env.STRIPE_SANDBOX_GRANTS_ENABLED !== "true") return;

  const giftSecret = sandboxPaidGiftSecret();
  if (checkout && giftSecret) await fulfillSandboxGift(stripe, receipt, giftSecret);
  const affected = await recordSandboxInvoiceHolds(stripe, receipt);
  if (affected.length === 0) {
    await reconcileSandboxSubscription(stripe, receipt, subscription);
  } else {
    for (const affectedSubscription of affected) {
      await reconcileSandboxSubscription(stripe, receipt, affectedSubscription);
    }
  }
}
