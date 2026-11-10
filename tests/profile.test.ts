import { describe, expect, it } from "vitest";
import { canonicalUsername, profileContent, safeLink, username } from "../src/lib/profile";

describe("profile validation", () => {
  it("canonicalises ASCII usernames and rejects confusables", () => {
    expect(canonicalUsername("  My-Page ")).toBe("my-page");
    expect(canonicalUsername("ｍypage")).toBe("");
    expect(canonicalUsername("my paGe")).toBe("");
    expect(username.safeParse("a-").success).toBe(false);
    expect(username.safeParse("a-b").success).toBe(true);
    expect(username.safeParse("a" + "x".repeat(29)).success).toBe(true);
    expect(username.safeParse("a" + "x".repeat(30)).success).toBe(false);
  });

  it("allows public web URLs and rejects schemes, local literals and credential tricks", () => {
    expect(safeLink("https://example.com/works?q=photo")).toBe(true);
    expect(safeLink("https://example.com:8080#works")).toBe(true);
    for (const url of [
      "javascript:alert(1)", "data:text/html,a", "file:///home", "//example.com",
      "https://user@example.com", "https://localhost/", "https://a.local/",
      "https://127.0.0.1/", "https://2130706433/", "https://0x7f.0.0.1/",
      "https://[::1]/", "https://example.com:65536", "https://example.com\\@other.com/",
    ]) expect(safeLink(url), url).toBe(false);
  });

  it("enforces the 20-link limit and the fixed theme catalogue", () => {
    const page = { display_name: "  Creator ", bio: "", theme: "midnight", indexable: false };
    const links = Array.from({ length: 20 }, (_, i) => ({ label: `Link ${i}`, url: "https://example.com/" }));
    expect(profileContent.parse({ ...page, links }).display_name).toBe("Creator");
    expect(profileContent.safeParse({ ...page, links: [...links, links[0]] }).success).toBe(false);
    expect(profileContent.safeParse({ ...page, links, theme: "malicious" }).success).toBe(false);
  });
});
