import { describe, expect, it } from "vitest";
import {
  decodeDiscoveryCursor, discoveryCategories, discoveryCollection, discoveryProfile,
  discoveryTags, discoveryCategoryLabel, discoveryProfiles, encodeDiscoveryCursor, firstSearchValue,
} from "./discovery";

const creator = {
  username: "sample-creator", display_name: "Sample Creator",
  bio: "Building interesting projects", avatar: null,
  category: "developers", tags: ["software", "roblox"],
  has_verified_domain: false, joined_at: "2026-11-24T09:00:00.000Z", rank_score: 700,
};

describe("public creator discovery data", () => {
  it("keeps public categories and interests allow-listed", () => {
    expect(discoveryCategories.map((entry) => entry.value)).toContain("developers");
    expect(discoveryTags).toContain("roblox");
    expect(discoveryCategoryLabel("unknown-category")).toBe("Other");
    expect(discoveryProfile.safeParse({ ...creator, category: "custom" }).success).toBe(false);
    expect(discoveryProfile.safeParse({ ...creator, tags: ["custom-tag"] }).success).toBe(false);
    expect(discoveryProfile.safeParse({ ...creator, tags: ["software","roblox","gaming","music","writing","fitness"] }).success).toBe(false);
    expect(discoveryProfile.safeParse({ ...creator, username: "Admin" }).success).toBe(false);
  });

  it("validates the exact public directory response shape", () => {
    expect(discoveryProfiles.safeParse([creator]).success).toBe(true);
    expect(discoveryProfiles.safeParse(Array.from({ length: 26 }, (_, index) => ({
      ...creator, username: "creator-" + index,
    }))).success).toBe(false);
  });

  it("round-trips stable cursors for every supported order", () => {
    expect(decodeDiscoveryCursor(encodeDiscoveryCursor(creator, "name"), "name"))
      .toEqual({ score: null, timestamp: null, username: creator.username });
    expect(decodeDiscoveryCursor(encodeDiscoveryCursor(creator, "recent"), "recent"))
      .toEqual({ score: null, timestamp: creator.joined_at, username: creator.username });
    expect(decodeDiscoveryCursor(encodeDiscoveryCursor(creator, "relevance"), "relevance"))
      .toEqual({ score: creator.rank_score, timestamp: creator.joined_at, username: creator.username });
  });

  it("rejects malformed, mismatched and unbounded cursors", () => {
    expect(decodeDiscoveryCursor("r|not-a-date|sample-creator", "recent")).toBeNull();
    expect(decodeDiscoveryCursor("n|sample-creator", "recent")).toBeNull();
    expect(decodeDiscoveryCursor("s|99999|2026-11-24T09%3A00%3A00.000Z|sample-creator", "relevance")).toBeNull();
    expect(decodeDiscoveryCursor("n|UPPERCASE", "name")).toBeNull();
    expect(decodeDiscoveryCursor("s|10|2026-11-24T09%3A00%3A00.000Z|sample-creator|extra", "relevance")).toBeNull();
  });

  it("validates curated collection cards and caps membership", () => {
    const collection = {
      slug: "developer-spotlight", collection_type: "featured", title: "Developer spotlight",
      description: "A few people building things.", sort_order: 1,
      created_at: creator.joined_at,
      profiles: [{
        username: creator.username, display_name: creator.display_name, bio: creator.bio,
        avatar: null, category: creator.category, tags: creator.tags, has_verified_domain: false,
      }],
    };
    expect(discoveryCollection.safeParse(collection).success).toBe(true);
    expect(discoveryCollection.safeParse({ ...collection, collection_type: "unknown" }).success).toBe(false);
    expect(discoveryCollection.safeParse({ ...collection, profiles: Array.from({ length: 21 }, (_, i) => ({
      ...collection.profiles[0], username: "creator-" + i,
    })) }).success).toBe(false);
  });

  it("normalises missing and repeated query values", () => {
    expect(firstSearchValue(undefined)).toBe("");
    expect(firstSearchValue("creator")).toBe("creator");
    expect(firstSearchValue(["creator", "ignored"])).toBe("creator");
    expect(firstSearchValue([])).toBe("");
  });
});
