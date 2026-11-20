import { describe, expect, it } from "vitest";
import { formatLeaderboardViews, leaderboardEntries } from "../src/lib/leaderboard";

describe("public views leaderboard", () => {
  const profile = { username: "valid-handle", display_name: "A public profile", avatar: null, views: "1234" };

  it("accepts bounded, public-only rows and formats large SQL bigint values", () => {
    expect(leaderboardEntries.parse([profile])).toHaveLength(1);
    expect(formatLeaderboardViews("1234567890123")).toBe("1,234,567,890,123");
    expect(formatLeaderboardViews(10000)).toBe("10,000");
  });

  it("rejects malformed usernames, non-numeric counts and more than fifty rows", () => {
    expect(leaderboardEntries.safeParse([{ ...profile, username: "../studio" }]).success).toBe(false);
    expect(leaderboardEntries.safeParse([{ ...profile, views: "-1" }]).success).toBe(false);
    expect(leaderboardEntries.safeParse([{ ...profile, views: "1.2" }]).success).toBe(false);
    expect(leaderboardEntries.safeParse(Array.from({ length: 51 }, () => profile)).success).toBe(false);
  });
});
