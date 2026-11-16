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
  });
}
