// Explicitly consented, independent codes for each profile and UTC day.
// Storage may retain an expired string until the next visit; it is never reused.
const prefix = "snoozer-analytics-browser-v3:";
type Store = Pick<Storage, "getItem" | "setItem" | "removeItem" | "key" | "length">;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function clearBrowserCodes(storage: Store, exceptDay?: string) {
  for (let index = storage.length - 1; index >= 0; index--) {
    const key = storage.key(index);
    if (key?.startsWith(prefix) && (!exceptDay || !key.startsWith(prefix + exceptDay + ":"))) storage.removeItem(key);
  }
}

export function browserCode(storage: Store, username: string, now: Date, random: () => string) {
  const browserDay = now.toISOString().slice(0, 10);
  try {
    clearBrowserCodes(storage, browserDay);
    const key = prefix + browserDay + ":" + username;
    const stored = storage.getItem(key);
    const browser = stored && uuid.test(stored) ? stored : random();
    if (!uuid.test(browser)) return {};
    // Prove storage is writable even when a code already exists.
    storage.setItem(key, browser);
    return { browser, browserDay };
  } catch { return {}; } // No ephemeral fallback that overcounts every reload.
}
