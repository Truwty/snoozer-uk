"use server";

import Stripe from "stripe";
import { redirect } from "next/navigation";
import { z } from "zod";
import { siteUrl } from "@/lib/env";
import { requireAccount } from "@/lib/profiles-server";
import { sandboxCheckoutKey } from "@/lib/stripe-sandbox-checkout-config";
import { storageAdmin } from "@/lib/supabase";
import { recoverUnsavedSandboxCheckout } from "@/lib/stripe-unsaved-checkout";

class RecoveredCheckout extends Error {}

const offer = z.object({ plan: z.enum(["plus", "pro", "studio"]), interval: z.enum(["month", "year"]) });
const attemptShape = z.object({
  id: z.uuid(), priceId: z.string(), amount: z.number().int().positive(),
  customerId: z.string().nullable(), sessionId: z.string().nullable(), expires: z.number().int(),
});

export async function startSandboxCheckout(form: FormData) {
  const { user } = await requireAccount();
  const key = sandboxCheckoutKey();
  const selection = offer.safeParse({ plan: form.get("plan"), interval: form.get("interval") });
  if (!key || !selection.success) redirect("/studio/plan?checkout=unavailable");

  const stripe = new Stripe(key, { timeout: 8000, maxNetworkRetries: 1 });
  const admin = storageAdmin();
  const { plan, interval } = selection.data;
  let checkoutUrl: string;
  try {
    const prepare = () => admin.rpc("prepare_stripe_sandbox_checkout", {
      p_owner: user.id, p_plan: plan, p_interval: interval,
    });
    let prepared = await prepare();
    if (prepared.error) throw prepared.error;
    if (prepared.data === null) {
      const recovered = await recoverUnsavedSandboxCheckout(stripe, user.id);
      if (recovered === "complete") throw new RecoveredCheckout();
      if (recovered === "retired") prepared = await prepare();
    }
    if (prepared.error) throw prepared.error;
    const attempt = attemptShape.parse(prepared.data);
    const bind = async (customer: string, session?: string) => {
      const binding = await admin.rpc("bind_stripe_sandbox_checkout", {
        p_owner: user.id, p_attempt: attempt.id, p_customer: customer, p_session: session ?? null,
      });
      if (binding.error || binding.data !== true) throw new Error("Checkout binding changed.");
    };

    let customer = attempt.customerId;
    if (!customer) {
      const created = await stripe.customers.create(
        { metadata: { snoozer_account: user.id } }, { idempotencyKey: "snoozer-customer-" + attempt.id },
      );
      if (created.livemode) throw new Error("Unexpected Stripe environment.");
      customer = created.id;
      await bind(customer);
    }

    let session: Stripe.Checkout.Session;
    if (attempt.sessionId) {
      session = await stripe.checkout.sessions.retrieve(attempt.sessionId);
    } else {
      const price = await stripe.prices.retrieve(attempt.priceId);
      if (price.livemode || !price.active || price.currency !== "gbp" || price.unit_amount !== attempt.amount
          || price.recurring?.interval !== interval || price.recurring.interval_count !== 1
          || price.recurring.usage_type !== "licensed") throw new Error("Stripe price does not match the offer.");
      const returnTo = new URL("/studio/plan", siteUrl());
      session = await stripe.checkout.sessions.create({
        mode: "subscription", customer, client_reference_id: user.id,
        expires_at: attempt.expires, line_items: [{ price: attempt.priceId, quantity: 1 }],
        success_url: new URL("?checkout=pending", returnTo).href,
        cancel_url: returnTo.href, integration_identifier: "snoozer-studio-hqvxmpta",
      }, { idempotencyKey: "snoozer-checkout-" + attempt.id });
    }
    if (session.livemode || !session.id.startsWith("cs_test_") || session.mode !== "subscription"
        || session.customer !== customer || session.client_reference_id !== user.id) {
      throw new Error("Stripe session does not match the attempt.");
    }
    await bind(customer, session.id);
    if (session.status !== "open" || !session.url) throw new Error("Checkout session is closed.");
    const target = new URL(session.url);
    if (target.origin !== "https://checkout.stripe.com") throw new Error("Unexpected Checkout origin.");
    checkoutUrl = target.href;
  } catch (error) {
    if (error instanceof RecoveredCheckout) redirect("/studio/plan?checkout=pending");
    redirect("/studio/plan?checkout=unavailable");
  }
  redirect(checkoutUrl);
}
