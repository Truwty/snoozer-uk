import { describe, expect, it } from "vitest";
import { parseHomepageStats } from "./homepage-stats";

describe("parseHomepageStats", () => {
  it("accepts non-negative integer totals returned by the aggregate RPC", () => {
    expect(parseHomepageStats({ members: 125, profiles: "98", views: 2400, uploads: "310" }))
      .toEqual({ members: 125, profiles: 98, views: 2400, uploads: 310 });
  });

  it("rejects incomplete, negative, fractional, unsafe or non-object values", () => {
    expect(parseHomepageStats({ members: 1, profiles: 2, views: -1, uploads: 4 })).toBeNull();
    expect(parseHomepageStats({ members: 1, profiles: 2, views: 3 })).toBeNull();
    expect(parseHomepageStats({ members: 1.5, profiles: 2, views: 3, uploads: 4 })).toBeNull();
    expect(parseHomepageStats(null)).toBeNull();
    expect(parseHomepageStats([])).toBeNull();
  });
});
