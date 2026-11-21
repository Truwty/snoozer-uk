import "server-only";
import { cookies } from "next/headers";
import { siteUrl } from "./env";
import { sessionClient } from "./supabase";
import {
  activeAccountCookie, rememberedAccountsCookie, persistentCookieAge,
  selectedAccountSlot, parseRememberedAccounts,
  type AccountSlot, type RememberedAccount,
} from "./account-slots";

const cookieOptions = () => ({
  httpOnly: true as const,
  secure: siteUrl().protocol === "https:",
  sameSite: "lax" as const,
  path: "/",
  maxAge: persistentCookieAge,
});

export async function activeAccount() {
  const jar = await cookies();
  return selectedAccountSlot(jar.get(activeAccountCookie)?.value);
}

export async function rememberedAccounts() {
  const jar = await cookies();
  return parseRememberedAccounts(jar.get(rememberedAccountsCookie)?.value);
}

export async function setActiveAccount(slot: AccountSlot) {
  const jar = await cookies();
  jar.set(activeAccountCookie, slot, cookieOptions());
}

async function saveRememberedAccounts(accounts: RememberedAccount[]) {
  const jar = await cookies();
  if (accounts.length) jar.set(rememberedAccountsCookie, JSON.stringify(accounts), cookieOptions());
  else jar.delete(rememberedAccountsCookie);
}

// The index is only UI metadata. It cannot authenticate anyone: switching always
// verifies the requested slot against Supabase using that slot's own HTTP-only tokens.
export async function rememberSignedInAccount() {
  const slot = await activeAccount();
  const client = await sessionClient(slot);
  const { data, error } = await client.auth.getUser();
  const user = data.user;
  if (error || !user?.email_confirmed_at) return false;
  const email = user.email ?? "";
  const metadata = user.user_metadata ?? {};
  const providedLabel = [metadata.full_name, metadata.name, metadata.user_name]
    .find((value): value is string => typeof value === "string" && value.trim().length > 0);
  const label = (providedLabel || email.split("@")[0] || "Snoozer account").slice(0, 100);
  const existing = await rememberedAccounts();
  const next = [...existing.filter((account) => account.slot !== slot), { slot, id: user.id, email, label }];
  await saveRememberedAccounts(next);
  return true;
}

export async function forgetRememberedAccount(slot: AccountSlot) {
  const next = (await rememberedAccounts()).filter((entry) => entry.slot !== slot);
  await saveRememberedAccounts(next);
  return next;
}
