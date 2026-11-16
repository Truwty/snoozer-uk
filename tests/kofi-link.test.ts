import { describe, expect, it } from "vitest";
import { kofiProfileUrl } from "../src/lib/kofi-link";

describe("Ko-fi profile links", () => {
  it("normalises a direct profile without changing the creator handle", () => {
    expect(kofiProfileUrl(" https://www.ko-fi.com/Creator_One/ ")).toBe("https://ko-fi.com/Creator_One");
  });

  it.each([
    "https://ko-fi.com.example.org/creator", "https://ko-fi.com@example.org/creator",
    "https://ko-fi.com/creator/extra", "http://ko-fi.com/creator",
    "https://ko-fi.com/creator?redirect=https://example.org", "https://ko-fi.com",
  ])("rejects a URL that is not a direct Ko-fi profile", (url) => {
    expect(kofiProfileUrl(url)).toBeNull();
  });
});
