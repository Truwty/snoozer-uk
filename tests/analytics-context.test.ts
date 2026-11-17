import { describe, expect, it } from "vitest";
import { analyticsDevice, browserAttribution, attributionForConsentVersion } from "../src/lib/analytics-context";
import { trafficAnalytics, trafficAnalyticsCsv } from "../src/lib/analytics";

const campaign = "00000000-0000-4000-8000-000000000011";
describe("coarse analytics context", () => {
  it("does not expand legacy consent into new device or campaign collection", () => {
    expect(attributionForConsentVersion({ source: "email", campaign }, "Mozilla Mobile"))
      .toEqual({ source: "direct", campaign: null, device: "unknown" });
    expect(attributionForConsentVersion({ version: 2, source: "email", campaign }, "Mozilla Mobile"))
      .toEqual({ source: "email", campaign, device: "mobile" });
  });
  it("transmits only a known source and a generated campaign code, never full URLs or private query text", () => {
    const context = browserAttribution(`https://snoozer.uk/creator?utm_campaign=${campaign}&email=private@example.com`,
      "https://www.google.com/search?q=sensitive-query");
    expect(context).toEqual({ source: "search", campaign });
    expect(JSON.stringify(context)).not.toMatch(/sensitive|private|https:/);
  });
  it.each([
    ["https://snoozer.uk/creator?utm_source=newsletter", "", "email"],
    ["https://snoozer.uk/creator?utm_campaign=private@example.com", "", "direct"],
    ["https://snoozer.uk/creator?utm_source=__proto__", "", "direct"],
    ["https://snoozer.uk/creator", "https://google.com.evil.com/search", "other"],
    ["https://snoozer.uk/creator", "https://snoozer.uk/studio", "direct"],
    ["https://snoozer.uk/creator", "https://t.co/example", "social"],
    ["https://snoozer.uk/creator", "https://github.com/example", "developer"],
    ["https://snoozer.uk/creator", "https://youtube.com/watch?v=example", "video"],
  ])("classifies a source without preserving unrecognised parameters: %s", (page, from, source) => {
    expect(browserAttribution(page, from)).toEqual({ source });
  });
  it.each([
    ["", "unknown"], ["Mozilla iPhone Mobile", "mobile"], ["Mozilla Android Mobile", "mobile"],
    ["Mozilla Android Tablet", "tablet"], ["Mozilla iPad", "tablet"], ["Mozilla Windows Chrome", "desktop"],
  ])("reduces user agents to a coarse, approximate device category", (agent, device) => {
    expect(analyticsDevice(agent)).toBe(device);
  });
  it("exports only fixed categories, counts and safely quoted creator labels", () => {
    const rows = trafficAnalytics.parse([{ campaign, label: "=1+1", source: "email", device: "mobile", views: 3, clicks: 2 }]);
    expect(trafficAnalyticsCsv(rows)).toBe(`campaign,source,device,views,clicks\r\n"'=1+1",email,mobile,3,2\r\n`);
    expect(trafficAnalytics.safeParse([{ ...rows[0], source: "private@example.com" }]).success).toBe(false);
  });
});
