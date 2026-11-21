import "server-only";
import { cookies } from "next/headers";
import { siteUrl } from "@/lib/env";
import {
  accountCookieOptions, accountListCookie, activeAccountCookie, pendingAccountCookie,
  readSavedAccounts, selectedAccountSlot, validAccountSlot,
  type SavedAccount, primarySlot, maxSavedAccounts,
} from "@/lib/account-sessions";

type Jar = Awaited<ReturnType<typeof cookies>>;
const secure = () => siteUrl().protocol === "https:";
export function storedAccounts(jar: Jar) {
  return readSavedAccounts(jar.get(accountListCookie)?.value);
}
export function currentSlot(jar: Jar) {
  return selectedAccountSlot(jar.get(activeAccountCookie)?.value, storedAccounts(jar));
}
export function pendingSlot(jar: Jar) {
  const slot = jar.get(pendingAccountCookie)?.value;
  return validAccountSlot(slot) ? slot : null;
}
export function markPending(jar: Jar, slot: string) {
  if (!validAccountSlot(slot)) throw new Error("Invalid pending slot");
  jar.set(pendingAccountCookie, slot, accountCookieOptions(secure(), 600));
}
export function clearPending(jar: Jar) {
  jar.delete(pendingAccountCookie);
}
export function chooseAccount(jar: Jar, slot: string) {
  if (!storedAccounts(jar).some((entry) => entry.slot === slot)) throw new Error("Unknown account slot");
  jar.set(activeAccountCookie, slot, accountCookieOptions(secure()));
}
export function saveAccount(jar: Jar, slot: string, userId: string, email?: string, label?: string) {
  if (!validAccountSlot(slot) || !validAccountSlot(userId)) throw new Error("Invalid user or account slot");
  const previous = storedAccounts(jar);
  const next: SavedAccount[] = previous.filter((item) => item.slot !== slot && item.userId !== userId);
  if (next.length >= maxSavedAccounts) throw new Error("Account limit reached");
  const display = (label || email?.split("@")[0] || "My account").slice(0, 40);
  next.push({ slot, userId, email: email?.slice(0, 254), label: display });
  jar.set(accountListCookie, JSON.stringify(next), accountCookieOptions(secure()));
  jar.set(activeAccountCookie, slot, accountCookieOptions(secure()));
}
export function removeAccountFromList(jar: Jar, slot: string) {
  const next = storedAccounts(jar).filter((item) => item.slot !== slot);
  jar.set(accountListCookie, JSON.stringify(next), accountCookieOptions(secure()));
  const fallback = next[0]?.slot;
  if (currentSlot(jar) === slot || !next.some((item) => item.slot === jar.get(activeAccountCookie)?.value)) {
    if (fallback) jar.set(activeAccountCookie, fallback, accountCookieOptions(secure()));
    else jar.delete(activeAccountCookie);
  }
}
export function isAtAccountLimit(jar: Jar) {
  return storedAccounts(jar).length >= maxSavedAccounts;
}
export const initialAccountSlot = primarySlot;
