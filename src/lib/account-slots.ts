// Small, fixed cookie namespaces avoid ever passing user input into Supabase's storage key.
export const accountSlots = ["primary", "slot-1", "slot-2", "slot-3", "slot-4"] as const;
export type AccountSlot = typeof accountSlots[number];
export type RememberedAccount = {
  slot: AccountSlot;
  id: string;
  email: string;
  label: string;
};
export const activeAccountCookie = "snoozer-active-account";
export const rememberedAccountsCookie = "snoozer-remembered-accounts";
export const persistentCookieAge = 60 * 60 * 24 * 400;

export function isAccountSlot(value: unknown): value is AccountSlot {
  return typeof value === "string" && accountSlots.some((slot) => slot === value);
}

export function selectedAccountSlot(value: unknown): AccountSlot {
  return isAccountSlot(value) ? value : "primary";
}

export function sessionCookieName(slot: AccountSlot) {
  // Keep the pre-existing, default Supabase cookie for legacy signed-in users.
  return slot === "primary" ? undefined : `snoozer-auth-${slot}`;
}

export function parseRememberedAccounts(raw?: string): RememberedAccount[] {
  if (!raw || raw.length > 2500) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const seen = new Set<AccountSlot>();
    const result: RememberedAccount[] = [];
    for (const entry of parsed) {
      if (!entry || typeof entry !== "object") continue;
      const item = entry as Record<string, unknown>;
      if (!isAccountSlot(item.slot) || seen.has(item.slot)
        || typeof item.id !== "string" || !/^[0-9a-f-]{36}$/i.test(item.id)
        || typeof item.email !== "string" || item.email.length > 254
        || typeof item.label !== "string" || item.label.length > 100) continue;
      seen.add(item.slot);
      result.push({ slot: item.slot, id: item.id, email: item.email, label: item.label });
      if (result.length === accountSlots.length) break;
    }
    return result;
  } catch {
    return [];
  }
}

export function nextFreeAccountSlot(accounts: RememberedAccount[]): AccountSlot | null {
  return accountSlots.slice(1).find((slot) => !accounts.some((account) => account.slot === slot)) ?? null;
}
