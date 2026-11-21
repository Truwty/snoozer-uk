"use server";

import { redirect } from "next/navigation";
import { requireAccount } from "@/lib/profiles-server";
import { openPremiumLiveCheckout, openPremiumLivePortal } from "@/lib/premium-live-service";

export async function startPremiumLiveCheckout(form: FormData) {
  const { user } = await requireAccount();
  let url: string;
  try {
    url = await openPremiumLiveCheckout(user.id, form.get("plan"), form.get("interval"));
  } catch {
    redirect("/studio/plan?premium=unavailable");
  }
  redirect(url);
}

export async function openPremiumLiveBillingPortal() {
  const { user } = await requireAccount();
  let url: string;
  try {
    url = await openPremiumLivePortal(user.id);
  } catch {
    redirect("/studio/plan?premium=portal-unavailable");
  }
  redirect(url);
}
