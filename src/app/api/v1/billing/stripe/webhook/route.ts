import { recordSandboxInvoiceHolds } from "@/lib/stripe-sandbox-invoice-holds";
import Stripe from "stripe";
import { reconcileSandboxSubscription } from "@/lib/stripe-sandbox-reconciliation";
import { bindSubscriptionFromReceipt } from "@/lib/stripe-subscription-binding";
import { receiveStripeWebhook } from "@/lib/stripe-webhook";
import { storageAdmin as serviceClient } from "@/lib/supabase";

export const runtime = "nodejs";

export function POST(request: Request) {
  return receiveStripeWebhook(request, process.env.STRIPE_SANDBOX_WEBHOOK_SECRET, async (receipt) => {
    const { error } = await serviceClient().rpc("record_stripe_sandbox_event", {
      p_id: receipt.id,
      p_type: receipt.type,
      p_object: receipt.objectId,
      p_occurred_at: receipt.occurredAt,
    });
    if (error) throw new Error("Stripe receipt could not be saved.");
    const key = process.env.STRIPE_SANDBOX_API_KEY;
    if (!key || !/^(rk|sk)_test_/.test(key)) return;

    const stripe = new Stripe(key, { timeout: 5000, maxNetworkRetries: 0 });
    const checkout = receipt.type === "checkout.session.completed"
      || receipt.type === "checkout.session.async_payment_succeeded";
    const subscription = checkout ? await bindSubscriptionFromReceipt(receipt.id, stripe) : undefined;
    if (process.env.STRIPE_SANDBOX_GRANTS_ENABLED === "true") {
      const affected = await recordSandboxInvoiceHolds(stripe, receipt);
      for (const affectedSubscription of affected) {
        await reconcileSandboxSubscription(stripe, receipt, affectedSubscription);
      }
      if (affected.length === 0) await reconcileSandboxSubscription(stripe, receipt, subscription);
    }
  });
}
