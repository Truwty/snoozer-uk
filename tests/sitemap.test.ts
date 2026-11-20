import { describe, expect, it } from "vitest";
import { sitemapEntries } from "../src/lib/sitemap";

describe("public sitemap entries", () => {
  it("includes public site pages and profile modification dates on the configured origin", () => {
    const changed = "2026-11-20T08:30:00.000Z";
    expect(sitemapEntries(new URL("https://snoozer.uk/"), [{ username: "alice", last_modified: changed }])).toEqual([
      { url: "https://snoozer.uk/", changeFrequency: "weekly", priority: 1 },
      { url: "https://snoozer.uk/templates", changeFrequency: "monthly", priority: 0.7 },
      { url: "https://snoozer.uk/privacy", changeFrequency: "yearly", priority: 0.3 },
      { url: "https://snoozer.uk/terms", changeFrequency: "yearly", priority: 0.3 },
      { url: "https://snoozer.uk/alice", lastModified: new Date(changed), changeFrequency: "weekly", priority: 0.6 },
    ]);
  });
});
