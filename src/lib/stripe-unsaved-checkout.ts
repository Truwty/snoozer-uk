import "server-only";
import type Stripe from "stripe";
import { z } from "zod";
import { storageAdmin } from "@/lib/supabase";

const staleAttempt = z.object({
  id: z.uuid(), customer_id: z.string().nullable(), created_epoch: z.number().int(), expires_epoch: z.number().int(),
});

export async function recoverUnsavedSandboxCheckout(stripe: Stripe, owner: string) {
  const admin = storageAdmin();
  const lookup = await admin.rpc("get_stale_stripe_sandbox_checkout", { p_owner: owner }).maybeSingle();
  if (lookup.error) throw new Error("Checkout recovery lookup failed.");
  if (!lookup.data) return "none";
  const attempt = staleAttempt.parse(lookup.data);
  let match: Stripe.Checkout.Session | undefined;
  if (attempt.customer_id) {
    for await (const session of stripe.checkout.sessions.list({
      customer: attempt.customer_id, created: { gte: attempt.created_epoch - 300, lte: attempt.expires_epoch },
    })) {
      // The fixed expiry and account
      // reference identify sessions while this account has one current attempt.
      if (session.customer !== attempt.customer_id || session.client_reference_id !== owner
          || session.expires_at !== attempt.expires_epoch) continue;
      if (match || session.livemode || session.mode !== "subscription" || !session.id.startsWith("cs_test_")) {
        throw new Error("Ambiguous Stripe Checkout recovery.");
      }
      match = session;
    }
  }

  if (match && match.status !== "expired") {
    if (match.status !== "complete" || typeof match.subscription !== "string") {
      throw new Error("Stripe Checkout state is unresolved.");
    }
    const saved = await admin.rpc("bind_stripe_sandbox_checkout", {
      p_owner: owner, p_attempt: attempt.id, p_customer: attempt.customer_id, p_session: match.id,
    });
    if (saved.error || saved.data !== true) throw new Error("Checkout binding changed.");
    return "complete";
  }
  if (match && match.subscription !== null) throw new Error("Expired Stripe Checkout has a subscription.");

  const retired = await admin.rpc("retire_unsaved_stripe_sandbox_checkout", {
    p_owner: owner, p_attempt: attempt.id, p_customer: attempt.customer_id, p_expired_session: match?.id ?? null,
  });
  if (retired.error || retired.data !== true) throw new Error("Checkout retirement changed.");
  return "retired";
}
