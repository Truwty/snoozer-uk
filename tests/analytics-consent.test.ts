import { describe, expect, it } from "vitest";
import { analyticsConsentKey, readAnalyticsConsent, saveAnalyticsConsent } from "../src/lib/analytics-consent";

function store() {
  const data = new Map<string, string>();
  return {
    get length() { return data.size; },
    key: (index: number) => [...data.keys()][index] ?? null,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); },
    removeItem: (key: string) => { data.delete(key); },
  };
}

describe("optional analytics consent", () => {
  it("persists an explicit opt-in and clears scoped browser codes when withdrawn", () => {
    const storage = store();
    storage.setItem("snoozer-analytics-browser-v3:2026-11-17:alice", "browser-code");
    storage.setItem("unrelated", "keep");
    saveAnalyticsConsent(storage, true);
    expect(readAnalyticsConsent(storage)).toBe(true);

    saveAnalyticsConsent(storage, false);
    expect(readAnalyticsConsent(storage)).toBe(false);
    expect(storage.getItem("snoozer-analytics-browser-v3:2026-11-17:alice")).toBeNull();
    expect(storage.getItem("unrelated")).toBe("keep");
  });

  it("preserves old opt-outs without treating old opt-ins as fresh consent", () => {
    const storage = store();
    storage.setItem("snoozer-analytics-consent-v2", "no");
    expect(readAnalyticsConsent(storage)).toBe(false);
    expect(storage.getItem(analyticsConsentKey)).toBe("no");

    const oldOptIn = store();
    oldOptIn.setItem("snoozer-analytics-consent-v2", "yes");
    expect(readAnalyticsConsent(oldOptIn)).toBeNull();
  });

  it("does not grant consent when browser storage is not writable", () => {
    const storage = store();
    storage.setItem(analyticsConsentKey, "yes");
    storage.setItem = () => { throw new Error("Blocked"); };
    expect(() => readAnalyticsConsent(storage)).toThrow("Blocked");
    expect(() => saveAnalyticsConsent(storage, true)).toThrow("Blocked");
  });
});
