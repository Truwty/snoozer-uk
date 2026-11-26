import { describe, expect, it } from "vitest";
import { filterStudioNavigation, studioNavigationGroups } from "../src/lib/studio-navigation";

describe("Studio navigation", () => {
  it("matches the reference order for the first-level dashboard destinations", () => {
    expect(studioNavigationGroups[0].label).toBe("Account");
    expect(studioNavigationGroups[0].items.map((item) => item.label)).toEqual([
      "Overview", "Analytics", "Settings",
    ]);
    expect(studioNavigationGroups[1].label).toBe("Main");
    expect(studioNavigationGroups[1].items.map((item) => item.label)).toEqual([
      "Customize", "Links", "Premium", "Image Host", "Profile Gallery", "Templates",
    ]);
  });

  it("preserves all Snoozer destinations in the expanded tools group", () => {
    const hrefs = studioNavigationGroups.flatMap((group) => group.items.map((item) => item.href));
    for (const href of [
      "/studio/account", "/studio/customize", "/studio/builder", "/studio/links", "/studio/plan",
      "/studio/settings", "/studio/gallery", "/studio/templates", "/studio/widgets", "/studio/discord",
      "/studio/spotify", "/studio/history", "/studio/discovery", "/studio/growth",
      "/account/notifications", "/account/data",
    ]) expect(hrefs).toContain(href);
    expect(studioNavigationGroups[2].label).toBe("More Snoozer tools");
    expect(hrefs).not.toContain("/studio/badges");
    expect(hrefs).not.toContain("/owner/badges");
    expect(filterStudioNavigation("achievement badge")).toEqual([]);
  });

  it("filters across labels and keywords without returning empty groups", () => {
    expect(filterStudioNavigation("appearance").flatMap((group) => group.items).map((item) => item.href))
      .toContain("/studio/customize");
    expect(filterStudioNavigation("email security").flatMap((group) => group.items).map((item) => item.href))
      .toContain("/studio/account");
    expect(filterStudioNavigation("gallery").flatMap((group) => group.items).map((item) => item.href))
      .toContain("/studio/gallery");
    expect(filterStudioNavigation("gift").flatMap((group) => group.items).map((item) => item.href))
      .toContain("/studio/plan");
    expect(filterStudioNavigation("not-a-real-feature")).toEqual([]);
  });
});
