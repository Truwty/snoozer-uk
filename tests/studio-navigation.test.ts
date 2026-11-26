import { describe, expect, it } from "vitest";
import { filterStudioNavigation, studioNavigationGroups } from "../src/lib/studio-navigation";

describe("Studio navigation", () => {
  it("matches the reference order for all dashboard destinations", () => {
    expect(studioNavigationGroups.map((group) => group.label)).toEqual(["Account", "Main"]);
    expect(studioNavigationGroups[0].items.map((item) => item.label)).toEqual([
      "Overview", "Analytics", "Badges", "Settings",
    ]);
    expect(studioNavigationGroups[1].items.map((item) => item.label)).toEqual([
      "Customize", "Links", "Premium", "Image Host", "Templates",
    ]);
  });

  it("does not expose additional Snoozer-only tools in the dashboard navigation", () => {
    const hrefs = studioNavigationGroups.flatMap((group) => group.items.map((item) => item.href));
    for (const href of [
      "/studio", "/studio/analytics", "/studio/badges", "/studio/account",
      "/studio/customize", "/studio/links", "/studio/plan", "/studio/image-host", "/studio/templates",
    ]) expect(hrefs).toContain(href);
    for (const href of [
      "/studio/builder", "/studio/settings", "/studio/gallery", "/studio/widgets", "/studio/discord",
      "/studio/spotify", "/studio/history", "/studio/discovery", "/studio/growth",
      "/account/notifications", "/account/data",
    ]) expect(hrefs).not.toContain(href);
    expect(studioNavigationGroups).toHaveLength(2);
  });

  it("filters destinations by the features shown in the reference", () => {
    expect(filterStudioNavigation("appearance").flatMap((group) => group.items).map((item) => item.href))
      .toContain("/studio/customize");
    expect(filterStudioNavigation("email security").flatMap((group) => group.items).map((item) => item.href))
      .toContain("/studio/account");
    expect(filterStudioNavigation("gallery").flatMap((group) => group.items).map((item) => item.href))
      .toContain("/studio/image-host");
    expect(filterStudioNavigation("gift").flatMap((group) => group.items).map((item) => item.href))
      .toContain("/studio/plan");
    expect(filterStudioNavigation("achievement badge").flatMap((group) => group.items).map((item) => item.href))
      .toContain("/studio/badges");
    expect(filterStudioNavigation("not-a-real-feature")).toEqual([]);
  });
});
