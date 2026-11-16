"use server";

import Stripe from "stripe";
import { redirect } from "next/navigation";
import { z } from "zod";
import { siteUrl } from "@/lib/env";
import { requireAccount } from "@/lib/profiles-server";
import { sandboxPaidGiftConfiguration } from "@/lib/stripe-sandbox-paid-gift";
import { storageAdmin } from "@/lib/supabase";

const selection = z.object({ offer: z.uuid(), request: z.uuid() });
const orderShape = z.object({
  order_id: z.uuid(), stripe_price: z.string(), amount_pence: z.number().int().positive(),
  session_id: z.string().nullable(), expires_epoch: z.number().int(),
});

export async function startSandboxGiftCheckout(form: FormData) {
  const { user } = await requireAccount();
  const config = sandboxPaidGiftConfiguration();
  const input = selection.safeParse({ offer: form.get("offer"), request: form.get("request") });
  if (!config || !input.success) redirect("/studio/plan/gifts?status=unavailable");
  let target: URL;
  try {
    const admin = storageAdmin();
    const { data, error } = await admin.rpc("prepare_stripe_sandbox_gift", {
      p_buyer: user.id, p_offer: input.data.offer, p_request: input.data.request,
    }).maybeSingle();
    if (error) throw error;
    const order = orderShape.parse(data);
    const stripe = new Stripe(config.key, { timeout: 8000, maxNetworkRetries: 1 });
    let session: Stripe.Checkout.Session;
    if (order.session_id) {
      session = await stripe.checkout.sessions.retrieve(order.session_id);
    } else {
      const price = await stripe.prices.retrieve(order.stripe_price);
      if (price.livemode || !price.active || price.type !== "one_time" || price.currency !== "gbp"
          || price.unit_amount !== order.amount_pence) throw new Error("Gift price changed.");
      const returnTo = new URL("/studio/plan/gifts", siteUrl());
      session = await stripe.checkout.sessions.create({
        mode: "payment", client_reference_id: user.id, expires_at: order.expires_epoch,
        metadata: { snoozer_gift_order: order.order_id },
        line_items: [{ price: order.stripe_price, quantity: 1 }],
        success_url: new URL("?status=pending", returnTo).href, cancel_url: returnTo.href,
        integration_identifier: "snoozer-gift-wtprmsve",
      }, { idempotencyKey: "snoozer-gift-" + order.order_id });
    }
    if (session.livemode || !session.id.startsWith("cs_test_") || session.mode !== "payment"
        || session.client_reference_id !== user.id || session.metadata?.snoozer_gift_order !== order.order_id
        || session.status !== "open" || !session.url) throw new Error("Gift checkout session unavailable.");
    const bound = await admin.rpc("bind_stripe_sandbox_gift_session", {
      p_buyer: user.id, p_order: order.order_id, p_session: session.id,
    });
    if (bound.error || bound.data !== true) throw new Error("Gift checkout binding changed.");
    target = new URL(session.url);
    if (target.origin !== "https://checkout.stripe.com" || target.username || target.password) {
      throw new Error("Unexpected Stripe redirect.");
    }
  } catch {
    redirect("/studio/plan/gifts?status=unavailable");
  }
  redirect(target.href);
}
