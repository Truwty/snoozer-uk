import { describe, expect, it } from "vitest";
import { canonicalUsername, defaultAppearance, link, profileAppearance, profileBackgroundImage, profileContent, profileTemplateStyles, safeLink, username } from "../src/lib/profile";

describe("profile validation", () => {
  it("accepts only registered first-party template style tokens and leaves older profiles valid", () => {
    expect(profileTemplateStyles).toHaveLength(30);
    for (const templateStyle of profileTemplateStyles) {
      expect(profileAppearance.safeParse({ ...defaultAppearance, templateStyle }).success).toBe(true);
    }
    expect(profileAppearance.safeParse({ ...defaultAppearance, templateStyle: "untrusted-style" }).success).toBe(false);
    expect(profileAppearance.safeParse(defaultAppearance).success).toBe(true);
  });

  it("accepts only bounded built-in motion presets without executable appearance settings", () => {
    for (const entrance of ["none", "fade", "rise"]) expect(profileAppearance.parse({ ...defaultAppearance, entrance }).entrance).toBe(entrance);
    for (const entrance of ["loop", "bounce", "url(https://example.com)", null]) expect(profileAppearance.safeParse({ ...defaultAppearance, entrance }).success).toBe(false);
    expect(profileAppearance.safeParse({ ...defaultAppearance, duration: 999999 }).success).toBe(false);
  });

  it("accepts bounded custom colour, surface, typography and glow settings", () => {
    const appearance = profileAppearance.parse({
      ...defaultAppearance,
      colors: {
        background: "#121827", text: "#f8fafc", accent: "#8b5cf6", icon: "#e2e8f0",
        effect: "#22d3ee", gradientStart: "#111827", gradientEnd: "#4c1d95",
      },
      font: "mono", gradientEnabled: true, opacity: 65, blur: 14,
      monochromeIcons: true, animatedTitle: true, usernameGlow: true, socialGlow: true, badgeGlow: true,
    });
    expect(appearance.opacity).toBe(65);
    expect(appearance.blur).toBe(14);
    expect(appearance.colors?.gradientEnd).toBe("#4c1d95");
    expect(appearance.font).toBe("mono");
    for (const colors of [{ background: "red" }, { text: "#fff" }, { customCss: "url(https://example.com)" }]) {
      expect(profileAppearance.safeParse({ ...defaultAppearance, colors }).success).toBe(false);
    }
    expect(profileAppearance.safeParse({ ...defaultAppearance, opacity: 39 }).success).toBe(false);
    expect(profileAppearance.safeParse({ ...defaultAppearance, blur: 25 }).success).toBe(false);
    expect(profileAppearance.safeParse({ ...defaultAppearance, font: "url(https://example.com)" }).success).toBe(false);
  });

  it("allows a gallery image as the profile background only when that image is in the profile gallery", () => {
    const id = "00000000-0000-4000-8000-000000000011";
    const appearance = profileAppearance.parse({ ...defaultAppearance, backgroundImage: id });
    const gallery = [{ id, alt: "Blue shoreline", width: 800, height: 600 }];
    expect(profileBackgroundImage({ appearance, gallery })).toEqual(gallery[0]);
    expect(profileBackgroundImage({ appearance, gallery: [] })).toBeNull();
    expect(profileAppearance.safeParse({ ...defaultAppearance, backgroundImage: "not-an-id" }).success).toBe(false);
  });

  it("defaults new profile links to visible and validates visibility as a boolean", () => {
    expect(link.parse({ label: "GitHub", url: "https://github.com/example" }).hidden).toBeUndefined();
    expect(link.parse({ label: "Private", url: "https://example.com/private", hidden: true }).hidden).toBe(true);
    expect(link.safeParse({ label: "Bad visibility", url: "https://example.com", hidden: "yes" }).success).toBe(false);
  });

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

  it("enforces the supported link ceiling and the fixed theme catalogue", () => {
    const page = { display_name: "  Creator ", bio: "", theme: "midnight", indexable: false };
    const links = Array.from({ length: 2000 }, (_, i) => ({ label: `Link ${i}`, url: "https://example.com/" }));
    expect(profileContent.parse({ ...page, links }).display_name).toBe("Creator");
    expect(profileContent.safeParse({ ...page, links: [...links, links[0]] }).success).toBe(false);
    expect(profileContent.safeParse({ ...page, links, theme: "malicious" }).success).toBe(false);
  });
});
