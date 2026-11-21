import { describe, expect, it } from "vitest";
import {
  accountSlots, activeAccountCookie, isAccountSlot, nextFreeAccountSlot,
  parseRememberedAccounts, persistentCookieAge, rememberedAccountsCookie,
  selectedAccountSlot, sessionCookieName,
} from "../src/lib/account-slots";

describe("persistent account slots", () => {
  const first = { slot: "primary" as const, id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", email: "alice@example.com", label: "Alice" };
  const second = { slot: "slot-1" as const, id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", email: "bob@example.com", label: "Bob" };

  it("keeps existing Supabase session storage unchanged for current users", () => {
    expect(sessionCookieName("primary")).toBeUndefined();
    expect(sessionCookieName("slot-1")).toBe("snoozer-auth-slot-1");
    expect(sessionCookieName("slot-2")).not.toBe(sessionCookieName("slot-1"));
    expect(activeAccountCookie).not.toBe(rememberedAccountsCookie);
    expect(persistentCookieAge).toBeGreaterThan(365 * 24 * 60 * 60);
  });

  it("allows only a fixed set of server-controlled cookie namespaces", () => {
    expect(accountSlots).toHaveLength(5);
    expect(isAccountSlot("slot-4")).toBe(true);
    expect(isAccountSlot("slot-999")).toBe(false);
    expect(isAccountSlot("../../../admin")).toBe(false);
    expect(selectedAccountSlot("../../../admin")).toBe("primary");
    expect(selectedAccountSlot(undefined)).toBe("primary");
  });

  it("parses a bounded, de-duplicated account roster rather than trusting raw cookie JSON", () => {
    expect(parseRememberedAccounts(JSON.stringify([first, second]))).toEqual([first, second]);
    expect(parseRememberedAccounts("broken")).toEqual([]);
    expect(parseRememberedAccounts("".padEnd(2501, "a"))).toEqual([]);
    expect(parseRememberedAccounts(JSON.stringify([first, first, { ...first, slot: "../../evil" }]))).toEqual([first]);
    expect(parseRememberedAccounts(JSON.stringify([{ ...first, id: "forged" }]))).toEqual([]);
    expect(parseRememberedAccounts(JSON.stringify([{ ...first, label: "x".repeat(101) }]))).toEqual([]);
  });

  it("allocates only unused slots, and refuses a sixth saved account", () => {
    expect(nextFreeAccountSlot([first])).toBe("slot-1");
    expect(nextFreeAccountSlot([first, second])).toBe("slot-2");
    expect(nextFreeAccountSlot(accountSlots.map((slot) => ({ ...first, slot })))).toBeNull();
  });
});
