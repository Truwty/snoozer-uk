import "server-only";
import Stripe from "stripe";
import { z } from "zod";
import { storageAdmin } from "@/lib/supabase";

const checkoutBinding = z.object({
  session_id: z.string(),
  customer_id: z.string(),
  owner_id: z.uuid(),
});

export async function bindSubscriptionFromReceipt(eventId: string, key: string) {
  const admin = storageAdmin();
  const { data, error } = await admin.rpc("stripe_sandbox_checkout_for_receipt", { p_event: eventId }).maybeSingle();
  if (error) throw new Error("Checkout binding lookup failed.");
  // The Checkout Session can be created before its ID is committed locally.
  // The operator can redeliver an unbound receipt after the attempt is recovered.
  if (!data) return;
  const binding = checkoutBinding.parse(data);
  const stripe = new Stripe(key, { timeout: 5000, maxNetworkRetries: 0 });
  const session = await stripe.checkout.sessions.retrieve(binding.session_id);
  if (session.livemode || session.mode !== "subscription" || session.status !== "complete"
      || session.id !== binding.session_id || session.customer !== binding.customer_id
      || session.client_reference_id !== binding.owner_id || typeof session.subscription !== "string") {
    throw new Error("Stripe subscription does not match Checkout ownership.");
  }

  const result = await admin.rpc("bind_stripe_sandbox_subscription", {
    p_event: eventId, p_session: session.id, p_customer: binding.customer_id,
    p_owner: binding.owner_id, p_subscription: session.subscription,
  });
  if (result.error || result.data !== true) throw new Error("Could not bind Stripe subscription.");
}
