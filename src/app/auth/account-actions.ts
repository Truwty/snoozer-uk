"use server";

import { redirect } from "next/navigation";
import { activeAccount, forgetRememberedAccount, rememberedAccounts, rememberSignedInAccount, setActiveAccount } from "@/lib/account-switching";
import { isAccountSlot, nextFreeAccountSlot } from "@/lib/account-slots";
import { sessionClient } from "@/lib/supabase";

export async function addAnotherAccount() {
  // Import existing sign-ins into the roster without altering their native cookies.
  await rememberSignedInAccount();
  const slot = nextFreeAccountSlot(await rememberedAccounts());
  if (!slot) redirect("/studio?account=limit");
  await setActiveAccount(slot);
  redirect("/sign-in?add=1");
}

export async function switchToAccount(form: FormData) {
  const requested = form.get("slot");
  const accounts = await rememberedAccounts();
  if (!isAccountSlot(requested)) redirect("/sign-in?account=missing");
  const entry = accounts.find((account) => account.slot === requested);
  if (!entry) redirect("/sign-in?account=missing");

  // An index cookie is NOT an authentication credential. Every switch requires
  // real Supabase validation of the isolated slot, before changing active state.
  const client = await sessionClient(requested);
  const { data, error } = await client.auth.getUser();
  if (error || !data.user?.email_confirmed_at || data.user.id !== entry.id) {
    await forgetRememberedAccount(requested);
    redirect("/sign-in?account=expired");
  }
  await setActiveAccount(requested);
  redirect("/studio");
}

export async function removeRememberedAccount(form: FormData) {
  const requested = form.get("slot");
  const entries = await rememberedAccounts();
  if (!isAccountSlot(requested) || !entries.some((entry) => entry.slot === requested)) {
    redirect("/sign-in?account=missing");
  }
  const client = await sessionClient(requested);
  // Remove only this device's session; never globally revoke other account devices.
  await client.auth.signOut({ scope: "local" });
  const remaining = await forgetRememberedAccount(requested);
  if ((await activeAccount()) === requested) {
    await setActiveAccount(remaining[0]?.slot ?? "primary");
    redirect(remaining.length ? "/studio" : "/");
  }
  redirect("/studio");
}
