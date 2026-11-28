import { describe, expect, it } from "vitest";
import {
  accountCookieOptions, isSessionCookieName, maxSavedAccounts, primarySlot,
  readSavedAccounts, remainingAccounts, selectedAccountSlot, sessionStorageName,
  validAccountSlot,
} from "@/lib/account-sessions";

const a = "3fa85f76-6ab3-42c0-a749-31e5d908fbbe";
const b = "7c28c2ea-5065-4991-83a8-4ca5180a5cba";

describe("browser-local account slots", () => {
  it("retains the original Supabase SSR session cookie namespace for existing users", () => {
    expect(sessionStorageName(primarySlot)).toBeUndefined();
    expect(readSavedAccounts(undefined)).toEqual([{ slot: primarySlot, label: "My account" }]);
    expect(selectedAccountSlot(undefined, readSavedAccounts(undefined))).toBe(primarySlot);
  });
  it("recognises default and numbered Supabase session cookie chunks", () => {
    expect(isSessionCookieName("sb-project-auth-token")).toBe(true);
    expect(isSessionCookieName("sb-project-auth-token.0")).toBe(true);
    expect(isSessionCookieName("sb-project-auth-token.12")).toBe(true);
    expect(isSessionCookieName("sb-project-auth-token.bad")).toBe(false);
    expect(isSessionCookieName("sb-project-auth-token-extra")).toBe(false);
    expect(isSessionCookieName("snoozer-session-slot", "snoozer-session-slot")).toBe(true);
    expect(isSessionCookieName("snoozer-session-slot.0", "snoozer-session-slot")).toBe(true);
    expect(isSessionCookieName("sb-project-auth-token", "snoozer-session-slot")).toBe(false);
  });
  it("isolates independently signed-in accounts into different HttpOnly cookie namespaces", () => {
    expect(sessionStorageName(a)).toBe(`snoozer-session-${a}`);
    expect(sessionStorageName(b)).not.toBe(sessionStorageName(a));
    expect(accountCookieOptions(true)).toMatchObject({ secure: true, httpOnly: true, sameSite: "lax", path: "/" });
    expect(accountCookieOptions(true).maxAge).toBeGreaterThan(300 * 24 * 60 * 60);
  });
  it("never trusts arbitrary slot identifiers or unbounded registry entries", () => {
    expect(validAccountSlot("other-user")).toBe(false);
    expect(() => sessionStorageName("unknown")).toThrow();
    expect(maxSavedAccounts).toBe(4);
    expect(readSavedAccounts(JSON.stringify([
      { slot: primarySlot, label: "User" },
      { slot: a, label: "Second" },
      { slot: a, label: "Duplicate" },
      { slot: b, label: "Third" },
      { slot: "../../other", label: "Bad" },
    ]))).toHaveLength(3);
  });
  it("falls back safely if an old or corrupted active cookie is supplied", () => {
    const accounts = readSavedAccounts(JSON.stringify([{ slot: a, label: "Second" }, { slot: b, label: "Third" }]));
    expect(selectedAccountSlot("forged", accounts)).toBe(a);
    expect(selectedAccountSlot(b, accounts)).toBe(b);
    expect(remainingAccounts(accounts, a)).toEqual([accounts[1]]);
    expect(readSavedAccounts("%bad")).toEqual([]);
  });
});
