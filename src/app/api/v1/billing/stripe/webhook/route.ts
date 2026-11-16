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
    if (key && /^(rk|sk)_test_/.test(key)
        && ["checkout.session.completed", "checkout.session.async_payment_succeeded"].includes(receipt.type)) {
      await bindSubscriptionFromReceipt(receipt.id, key);
    }
  });
}
