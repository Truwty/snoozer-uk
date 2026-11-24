import { describe, expect, it } from "vitest";
import { sitemapEntries } from "../src/lib/sitemap";
import { discoveryCategories } from "../src/lib/discovery";

describe("public sitemap entries", () => {
  it("includes public site pages, Discover categories and profile modification dates on the configured origin", () => {
    const changed = "2026-11-20T08:30:00.000Z";
    const entries = sitemapEntries(new URL("https://snoozer.uk/"), [{ username: "alice", last_modified: changed }]);

    expect(entries).toContainEqual({
      url: "https://snoozer.uk/", changeFrequency: "weekly", priority: 1,
    });
    expect(entries).toContainEqual({
      url: "https://snoozer.uk/templates", changeFrequency: "monthly", priority: 0.7,
    });
    expect(entries).toContainEqual({
      url: "https://snoozer.uk/discover", changeFrequency: "daily", priority: 0.8,
    });
    for (const category of discoveryCategories) {
      expect(entries).toContainEqual({
        url: "https://snoozer.uk/discover/category/" + category.value,
        changeFrequency: "weekly", priority: 0.6,
      });
    }
    expect(entries).toContainEqual({
      url: "https://snoozer.uk/privacy", changeFrequency: "yearly", priority: 0.3,
    });
    expect(entries).toContainEqual({
      url: "https://snoozer.uk/terms", changeFrequency: "yearly", priority: 0.3,
    });
    expect(entries).toContainEqual({
      url: "https://snoozer.uk/alice", lastModified: new Date(changed),
      changeFrequency: "weekly", priority: 0.6,
    });
  });
});
