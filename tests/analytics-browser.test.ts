import { describe, expect, it } from "vitest";
import { browserCode, clearBrowserCodes } from "../src/lib/analytics-browser";
import { browserKey } from "../src/lib/analytics-browser-server";
import { analyticsEvent, browserAnalytics, browserAnalyticsCsv, browserCtr } from "../src/lib/analytics";

const id = "00000000-0000-4000-8000-000000000001";
const other = "00000000-0000-4000-8000-000000000002";
function store() {
  const data = new Map<string, string>();
  return { get length() { return data.size; }, key: (index: number) => [...data.keys()][index] ?? null,
    getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); },
    removeItem: (key: string) => { data.delete(key); } };
}
describe("daily scoped browser observations", () => {
  const now = new Date("2026-11-17T22:00:00Z");
  it("reuses only the same profile and UTC day, removes expired codes and preserves unrelated storage", () => {
    const storage = store();
    storage.setItem("unrelated", "retained");
    expect(browserCode(storage, "alice", now, () => id)).toEqual({ browser: id, browserDay: "2026-11-17" });
    expect(browserCode(storage, "alice", now, () => other)).toEqual({ browser: id, browserDay: "2026-11-17" });
    expect(browserCode(storage, "bob", now, () => other).browser).toBe(other);
    expect(browserCode(storage, "alice", new Date("2026-11-18T00:00:00Z"), () => other).browser).toBe(other);
    expect(storage.length).toBe(2);
    clearBrowserCodes(storage);
    expect(storage.length).toBe(1);
    expect(storage.getItem("unrelated")).toBe("retained");
  });
  it("does not emit ephemeral browser codes if storage is blocked or read-only", () => {
    const storage = store();
    browserCode(storage, "alice", now, () => id);
    storage.setItem = () => { throw new Error("Blocked"); };
    expect(browserCode(storage, "alice", now, () => other)).toEqual({});
    storage.getItem = () => { throw new Error("Blocked"); };
    expect(browserCode(storage, "alice", now, () => id)).toEqual({});
  });
  it("hashes the profile and day, suppresses old consent and client clock skew", () => {
    const event = { username: "alice", version: 3, browser: id, browserDay: "2026-11-17" };
    expect(browserKey(event, now)).toMatch(/^[0-9a-f]{64}$/);
    expect(browserKey(event, now)).not.toContain(id);
    expect(browserKey({ ...event, username: "bob" }, now)).not.toBe(browserKey(event, now));
    expect(browserKey({ ...event, version: 2 }, now)).toBeNull();
    expect(browserKey({ ...event, browserDay: "2026-11-16" }, now)).toBeNull();
    expect(browserKey({ ...event, browserDay: "2026-11-18" }, new Date("2026-11-18T00:00:00Z"))).not.toBe(browserKey(event, now));
  });
  it("requires a complete browser pair under fresh scope while preserving older event contracts", () => {
    const base = { username: "alice", id, consent: true, kind: "view" };
    expect(analyticsEvent.safeParse(base).success).toBe(true);
    expect(analyticsEvent.safeParse({ ...base, version: 2 }).success).toBe(true);
    expect(analyticsEvent.safeParse({ ...base, version: 3, browser: id, browserDay: "2026-11-17" }).success).toBe(true);
    for (const payload of [
      { ...base, version: 2, browser: id, browserDay: "2026-11-17" }, { ...base, version: 3, browser: id },
      { ...base, version: 3, browserDay: "2026-11-17" }, { ...base, version: 3, browser: "fingerprint", browserDay: "2026-11-17" },
    ]) expect(analyticsEvent.safeParse(payload).success).toBe(false);
  });
  it("exports bounded daily observations and no invented ratio for an empty denominator", () => {
    const rows = browserAnalytics.parse([{ day: "2026-11-17", unique_browsers: 3, clicked_browsers: 1 },
      { day: "2026-11-16", unique_browsers: 0, clicked_browsers: 0 }]);
    expect(browserAnalyticsCsv(rows)).toBe("date_utc,daily_browsers,clicked_browsers,browser_ctr_percent\r\n2026-11-17,3,1,33.3\r\n2026-11-16,0,0,\r\n");
    expect(browserCtr(0, 0)).toBe("—");
    expect(browserCtr(3, 1)).toBe("33.3%");
    expect(browserAnalytics.safeParse([{ day: "2026-11-17", unique_browsers: 1, clicked_browsers: 2 }]).success).toBe(false);
  });
});
