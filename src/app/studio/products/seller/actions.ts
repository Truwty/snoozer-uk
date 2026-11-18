"use server";
import Stripe from "stripe";
import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/actions";
import { creatorMerchant } from "@/lib/creator-merchant";
import { creatorOnboardingUrl, creatorSandboxConfig, createCreatorSandboxAccount, readCreatorSandboxAccount } from "@/lib/creator-stripe";
import { siteUrl } from "@/lib/env";
import { requireAccount } from "@/lib/profiles-server";
import { storageAdmin } from "@/lib/supabase";

export async function manageCreatorSandbox(_: ActionState, form: FormData): Promise<ActionState> {
  const operation = z.enum(["onboard", "refresh"]).safeParse(form.get("operation"));
  if (!operation.success) return { status: "error", message: "Choose a seller setup action." };
  const { client, user } = await requireAccount();
  const config = creatorSandboxConfig();
  if (!config) return { status: "error", message: "Sandbox seller setup is waiting for operator configuration. No account was created." };
  const stripe = new Stripe(config.key, { timeout: 8000, maxNetworkRetries: 1 });
  const admin = storageAdmin();
  let target: string;
  try {
    if (operation.data === "refresh") {
      const result = await client.rpc("get_my_creator_sandbox_account");
      const merchant = creatorMerchant.safeParse(result.data);
      if (result.error || !merchant.success || !merchant.data.accountId || merchant.data.platformId !== config.platformId) return { status: "error", message: "A bound sandbox account is required. Start or resume setup first." };
      const claim = await admin.rpc("claim_creator_sandbox_check", { p_owner: user.id });
      if (claim.error || !z.uuid().safeParse(claim.data).success) return { status: "error", message: "A status check was attempted recently. Retry after a minute." };
      let ready = false;
      try { ready = (await readCreatorSandboxAccount(stripe, merchant.data)).ready; }
      catch {
        await admin.rpc("complete_creator_sandbox_check", { p_owner: user.id, p_account: merchant.data.accountId, p_lease: claim.data, p_ready: false });
        return { status: "error", message: "Stripe status could not be confirmed. Sandbox readiness is paused; try again later." };
      }
      const completed = await admin.rpc("complete_creator_sandbox_check", { p_owner: user.id, p_account: merchant.data.accountId, p_lease: claim.data, p_ready: ready });
      if (completed.error || completed.data !== true) return { status: "error", message: "The status check expired. Reload and retry after a minute." };
      return { status: "success", message: ready ? "Stripe confirmed active sandbox card-payment and payout capabilities. Public selling is still disabled." : "Stripe requires more onboarding or capability review. Resume setup to review requirements." };
    }
    if (form.get("country") !== "GB" || form.get("acknowledge") !== "on") return { status: "error", message: "Confirm UK sandbox testing and read the setup notice before continuing." };
    const reserved = await admin.rpc("reserve_creator_sandbox_account", { p_owner: user.id, p_platform: config.platformId, p_country: "GB" });
    const merchant = creatorMerchant.safeParse(reserved.data);
    if (reserved.error || !merchant.success) return { status: "error", message: reserved.error?.code === "P1210" ? "An older account-creation attempt needs operator reconciliation. A second Stripe account will not be created." : "Couldn’t reserve seller setup. Check profile ownership and sandbox configuration." };
    if (!merchant.data.accountId) {
      const accountId = await createCreatorSandboxAccount(stripe, merchant.data);
      const bound = await admin.rpc("bind_creator_sandbox_account", { p_owner: user.id, p_operation: merchant.data.id, p_account: accountId });
      if (bound.error || bound.data !== true) return { status: "error", message: "The Stripe account could not be bound. Retry this setup to reconcile the same attempt." };
      merchant.data.accountId = accountId;
    }
    target = await creatorOnboardingUrl(stripe, merchant.data, siteUrl());
  } catch {
    return { status: "error", message: "Stripe sandbox setup is unavailable. No live account or payment was created. Your existing setup attempt is retained for safe retry." };
  } finally { revalidatePath("/studio/products/seller"); }
  redirect(target);
}
