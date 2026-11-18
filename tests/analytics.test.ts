import { describe, expect, it, vi } from "vitest";
import { analyticsCsv, dailyAnalytics, linkAnalytics, linkAnalyticsCsv, receiveAnalytics } from "../src/lib/analytics";

const origin = "https://snoozer.uk";
const event = { username: "creator", kind: "view", consent: true, id: "00000000-0000-4000-8000-000000000011" };
function request(body: unknown = event, headers: Record<string, string> = {}) {
  return new Request(origin + "/api/v1/analytics/view", { method: "POST", body: JSON.stringify(body),
    headers: { origin, "content-type": "application/json", "user-agent": "Mozilla/5.0", ...headers } });
}

describe("consent-aware analytics boundary", () => {
  it("binds creator-host events to the profile served on that host", async () => {
    const record = vi.fn();
    expect((await receiveAnalytics(request(), origin, record, "another-creator")).status).toBe(403);
    expect(record).not.toHaveBeenCalled();
    expect((await receiveAnalytics(request(), origin, record, "creator")).status).toBe(204);
    expect(record).toHaveBeenCalledOnce();
  });
  it("acknowledges only after durable storage, returns a retryable failure and never caches", async () => {
    const record = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(undefined);
    expect((await receiveAnalytics(request(), origin, record)).status).toBe(503);
    const response = await receiveAnalytics(request(), origin, record);
    expect(response.status).toBe(204);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(record).toHaveBeenLastCalledWith(event);
  });
  it.each([
    { origin: "https://evil.example" }, { origin: "" }, { "user-agent": "Googlebot" },
    { "user-agent": "HeadlessChrome" }, { "user-agent": "" }, { "sec-gpc": "1" }, { dnt: "1" },
  ] as Record<string, string>[])("does not record cross-origin, bot or privacy-signalled events: %s", async (headers) => {
    const record = vi.fn();
    await receiveAnalytics(request(event, headers), origin, record);
    expect(record).not.toHaveBeenCalled();
  });
  it.each([
    { ...event, consent: false }, { ...event, consent: undefined }, { ...event, actor: "spoofed" },
    { ...event, id: "bad" }, { ...event, kind: "click", position: 0, url: "https://example.com" },
    { ...event, kind: "click", position: 1, url: "javascript:alert(1)" },
    { ...event, referrer: "https://example.com/private" }, { ...event, version: 1 },
    { ...event, source: "arbitrary private text" },
  ])("rejects invalid or forged fields: %s", async (payload) => {
    const record = vi.fn();
    expect((await receiveAnalytics(request(payload), origin, record)).status).toBe(400);
    expect(record).not.toHaveBeenCalled();
  });
  it("accepts a bounded click event and rejects oversized or incorrect media", async () => {
    const record = vi.fn();
    const payload = { ...event, kind: "click", position: 1, url: "https://example.com/work" };
    expect((await receiveAnalytics(request(payload), origin, record)).status).toBe(204);
    expect(record).toHaveBeenCalledWith(payload);
    expect((await receiveAnalytics(request("x".repeat(5000)), origin, record)).status).toBe(413);
    expect((await receiveAnalytics(request(event, { "content-type": "text/plain" }), origin, record)).status).toBe(415);
  });
  it("exports UTC dates and integer counts with no creator strings or identities", () => {
    const rows = dailyAnalytics.parse([{ day: "2026-11-17", views: 2, clicks: 3 }]);
    expect(analyticsCsv(rows)).toBe("date_utc,views,clicks\r\n2026-11-17,2,3\r\n");
    expect(dailyAnalytics.safeParse([{ day: "=FORMULA", views: 1, clicks: 1 }]).success).toBe(false);
  });
  it("quotes per-link CSV and neutralises spreadsheet formulas in creator labels", () => {
    const rows = linkAnalytics.parse([
      { label: '=HYPERLINK("https://evil.com")', url: "https://example.com", clicks: 2 },
      { label: 'Notes, "work"', url: "https://example.com/notes", clicks: 1 },
    ]);
    expect(linkAnalyticsCsv(rows)).toContain(`"'=HYPERLINK(""https://evil.com"")","https://example.com",2\r\n`);
    expect(linkAnalyticsCsv(rows)).toContain(`"Notes, ""work""","https://example.com/notes",1\r\n`);
    expect(linkAnalytics.safeParse([{ label: "Unsafe", url: "javascript:alert(1)", clicks: 1 }]).success).toBe(false);
  });
});
