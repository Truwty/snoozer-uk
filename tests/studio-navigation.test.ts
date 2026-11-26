import { describe, expect, it } from "vitest";
import { filterStudioNavigation, studioNavigationGroups } from "../src/lib/studio-navigation";

describe("Studio navigation", () => {
  it("matches the source navigation order", () => {
    expect(studioNavigationGroups.map((group) => group.label)).toEqual(["Account", "Main"]);
    expect(studioNavigationGroups[0].items.map((item) => item.label)).toEqual(["Overview", "Analytics", "Badges", "Settings"]);
    expect(studioNavigationGroups[1].items.map((item) => item.label)).toEqual(["Customize", "Links", "Premium", "Image Host", "Templates"]);
  });

  it("keeps the user-facing dashboard menu free of additional Snoozer-only tools", () => {
    const hrefs = studioNavigationGroups.flatMap((group) => group.items.map((item) => item.href));
    expect(hrefs).toEqual([
      "/studio", "/studio/analytics", "/studio/badges", "/studio/account",
      "/studio/customize", "/studio/links", "/studio/plan", "/studio/image-host", "/studio/templates",
    ]);
    expect(studioNavigationGroups).toHaveLength(2);
  });

  it("searches the reference destinations by feature name", () => {
    expect(filterStudioNavigation("appearance").flatMap((group) => group.items).map((item) => item.href)).toContain("/studio/customize");
    expect(filterStudioNavigation("email security").flatMap((group) => group.items).map((item) => item.href)).toContain("/studio/account");
    expect(filterStudioNavigation("gallery").flatMap((group) => group.items).map((item) => item.href)).toContain("/studio/image-host");
    expect(filterStudioNavigation("gift").flatMap((group) => group.items).map((item) => item.href)).toContain("/studio/plan");
    expect(filterStudioNavigation("achievement badge").flatMap((group) => group.items).map((item) => item.href)).toContain("/studio/badges");
    expect(filterStudioNavigation("not-a-real-feature")).toEqual([]);
  });
});
