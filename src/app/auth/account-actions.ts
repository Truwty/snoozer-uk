"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { chooseAccount, currentSlot, removeAccountFromList, storedAccounts } from "@/lib/account-session-server";
import { validAccountSlot } from "@/lib/account-sessions";
import { sessionClientForSlot } from "@/lib/supabase";

// Every switch revalidates its independent refresh-token cookie with Auth.
// Changing a slot ID in a form/cookie cannot grant another user's identity.
export async function switchAccount(form: FormData) {
  const jar = await cookies();
  const slot = form.get("slot");
  if (!validAccountSlot(slot)) redirect("/sign-in");
  const entry = storedAccounts(jar).find((item) => item.slot === slot);
  if (!entry) redirect("/sign-in");
  const { data, error } = await (await sessionClientForSlot(slot)).auth.getUser();
  if (error || !data.user || !data.user.email_confirmed_at || (entry.userId && entry.userId !== data.user.id)) {
    redirect("/sign-in?add=1&expired=1");
  }
  chooseAccount(jar, slot);
  redirect("/studio");
}

export async function removeSavedAccount(form: FormData) {
  const jar = await cookies();
  const slot = form.get("slot");
  if (!validAccountSlot(slot) || !storedAccounts(jar).some((item) => item.slot === slot)) redirect("/");
  const current = currentSlot(jar);
  const client = await sessionClientForSlot(slot);
  // Local revocation only. Do NOT revoke other browsers or saved identities.
  await client.auth.signOut({ scope: "local" });
  removeAccountFromList(jar, slot);
  redirect(slot === current ? "/" : "/studio");
}
