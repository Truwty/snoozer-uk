"use server";

import Stripe from "stripe";
import { redirect } from "next/navigation";
import { siteUrl } from "@/lib/env";
import { requireAccount } from "@/lib/profiles-server";
import { createSandboxPortalUrl, sandboxPortalConfiguration } from "@/lib/stripe-sandbox-portal";

export async function openSandboxPortal() {
  const { client } = await requireAccount();
  const config = sandboxPortalConfiguration();
  if (!config) redirect("/studio/plan?portal=unavailable");

  let target: string;
  try {
    const { data, error } = await client.rpc("get_my_stripe_sandbox_customer");
    if (error || typeof data !== "string") throw new Error("Billing account unavailable.");
    const stripe = new Stripe(config.key, { timeout: 8000, maxNetworkRetries: 0 });
    target = await createSandboxPortalUrl(stripe, data, config.configuration, siteUrl());
  } catch {
    redirect("/studio/plan?portal=unavailable");
  }
  redirect(target);
}
