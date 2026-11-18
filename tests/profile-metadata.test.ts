import { describe, expect, it } from "vitest";
import { publishedProfile, profileSeo } from "../src/lib/profile";
import { profileMetadata } from "../src/lib/profile-metadata";
const profile = publishedProfile.parse({ username: "metadata-example", display_name: "My work", bio: "A portfolio", theme: "lagoon", indexable: false, avatar: null, links: [] });
describe("published metadata", () => {
  it("uses public defaults, the configured origin and noindex even with custom copy", () => {
    const defaults = profileMetadata(profile, new URL("https://snoozer.uk"));
    expect(defaults.title).toBe("My work");
    expect(defaults.description).toBe("A portfolio");
    const result = profileMetadata({ ...profile, seo: { title: "Custom title", description: "Custom description" } }, new URL("https://snoozer.uk"));
    expect(result.title).toBe("Custom title");
    expect(result.alternates).toEqual({ canonical: "https://snoozer.uk/metadata-example" });
    expect(result.robots).toEqual({ index: false, follow: false });
    expect(result.openGraph).toMatchObject({ title: "Custom title", description: "Custom description", images: [{ url: "https://snoozer.uk/media/profile-card/metadata-example", width: 1200, height: 630 }] });
  });
  it("uses only the published ready domain for canonical URLs and retains platform social media origin", () => {
    const result = profileMetadata({ ...profile, custom_domain: "links.example.com" }, new URL("https://snoozer.uk"));
    expect(result.alternates).toEqual({ canonical: "https://links.example.com/" });
    expect(result.openGraph).toMatchObject({ url: "https://links.example.com/", images: [{ url: "https://snoozer.uk/media/profile-card/metadata-example" }] });
    expect(result.robots).toEqual({ index: false, follow: false });
  });
  it("does not accept arbitrary canonical/image URLs or oversized metadata", () => {
    expect(profileSeo.safeParse({ title: "a".repeat(71), description: "" }).success).toBe(false);
    expect(profileSeo.safeParse({ title: "", description: "a".repeat(161) }).success).toBe(false);
    expect(profileSeo.safeParse({ title: "", description: "", canonical: "https://evil.example" }).success).toBe(false);
    expect(profileSeo.parse({ title: " Trimmed ", description: " " })).toEqual({ title: "Trimmed", description: "" });
  });
});
