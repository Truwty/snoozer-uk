import { describe, expect, it } from "vitest";
import { filterStudioNavigation, studioNavigationGroups } from "../src/lib/studio-navigation";

describe("Studio navigation", () => {
  it("puts the account destinations first in the requested order", () => {
    expect(studioNavigationGroups[0].label).toBe("Account");
    expect(studioNavigationGroups[0].items.map((item) => item.label)).toEqual([
      "Overview", "Analytics", "Badges", "Settings",
    ]);
  });

  it("keeps every implemented dashboard destination discoverable", () => {
    const hrefs = studioNavigationGroups.flatMap((group) => group.items.map((item) => item.href));
    for (const href of [
      "/studio/account", "/studio/customize", "/studio/builder", "/studio/links", "/studio/plan",
      "/studio/settings", "/studio/gallery", "/studio/templates", "/studio/widgets", "/studio/discord",
      "/studio/spotify", "/studio/history", "/studio/discovery", "/studio/growth",
    ]) expect(hrefs).toContain(href);
  });

  it("filters across labels and keywords without returning empty groups", () => {
    expect(filterStudioNavigation("appearance").flatMap((group) => group.items).map((item) => item.href))
      .toContain("/studio/customize");
    expect(filterStudioNavigation("email security").flatMap((group) => group.items).map((item) => item.href))
      .toContain("/studio/account");
    expect(filterStudioNavigation("gallery").flatMap((group) => group.items).map((item) => item.href))
      .toContain("/studio/gallery");
    expect(filterStudioNavigation("not-a-real-feature")).toEqual([]);
  });
});
