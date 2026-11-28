// Shared, pure cookie-name/slot parsing. Identity is ALWAYS revalidated with
// Supabase Auth server-side; these browser cookies are not authorisation claims.
export const accountListCookie = "snoozer_saved_accounts_v1";
export const activeAccountCookie = "snoozer_active_account_v1";
export const pendingAccountCookie = "snoozer_pending_account_v1";
export const primarySlot = "primary";
export const maxSavedAccounts = 4;
export const sessionMaxAge = 60 * 60 * 24 * 365;

export type SavedAccount = { slot: string; userId?: string; email?: string; label: string };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validAccountSlot(value: unknown): value is string {
  return value === primarySlot || (typeof value === "string" && uuid.test(value));
}
export function sessionStorageName(slot: string) {
  if (!validAccountSlot(slot)) throw new Error("Invalid account slot");
  // The primary slot intentionally uses @supabase/ssr's existing default key.
  return slot === primarySlot ? undefined : `snoozer-session-${slot}`;
}
export function readSavedAccounts(raw: string | undefined): SavedAccount[] {
  if (raw === undefined) return [{ slot: primarySlot, label: "My account" }]; // legacy cookies
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return []; }
  if (!Array.isArray(parsed)) return [];
  const result: SavedAccount[] = [];
  for (const item of parsed.slice(0, maxSavedAccounts)) {
    if (!item || typeof item !== "object" || !("slot" in item) || !validAccountSlot(item.slot)
        || result.some((entry) => entry.slot === item.slot)) continue;
    const userId = "userId" in item && typeof item.userId === "string" && uuid.test(item.userId)
      ? item.userId : undefined;
    const email = "email" in item && typeof item.email === "string" && item.email.length <= 254
      ? item.email : undefined;
    const label = "label" in item && typeof item.label === "string" && item.label.trim().length <= 40
      ? item.label.trim() : "My account";
    result.push({ slot: item.slot, userId, email, label });
  }
  return result;
}
export function selectedAccountSlot(active: string | undefined, accounts: SavedAccount[]) {
  return accounts.find((item) => item.slot === active)?.slot ?? accounts[0]?.slot ?? primarySlot;
}
export function accountCookieOptions(secure: boolean, maxAge = sessionMaxAge) {
  return { httpOnly: true, sameSite: "lax" as const, secure, path: "/", maxAge };
}
export function remainingAccounts(accounts: SavedAccount[], slot: string) {
  return accounts.filter((account) => account.slot !== slot);
}

/** Recognise an unsuffixed Supabase session cookie and its numbered chunks. */
export function isSessionCookieName(cookieName: string, storageName?: string) {
  if (storageName) return cookieName === storageName || cookieName.startsWith(storageName + ".");
  return /^sb-[A-Za-z0-9_-]+-auth-token(?:\.\d+)?$/.test(cookieName);
}
