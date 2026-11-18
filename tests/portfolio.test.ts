import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ProfileCard } from "../src/components/profile-card";
import { defaultAppearance, publishedProfile, textSections } from "../src/lib/profile";

const project = { kind: "project", heading: "My project", body: "How it was made.", target: "https://example.com/work" };
describe("portfolio projects", () => {
  it("requires a bounded public web target only for project and countdown sections", () => {
    expect(textSections.safeParse([project]).success).toBe(true);
    for (const target of [undefined, "", "javascript:alert(1)", "https://user@example.com", "https://localhost/", "https://127.0.0.1/", "https://example.com:65536", "https://example.com/" + "x".repeat(2048)]) {
      expect(textSections.safeParse([{ ...project, target }]).success, String(target)).toBe(false);
    }
    expect(textSections.safeParse([{ ...project, kind: "text" }]).success).toBe(false);
    expect(textSections.safeParse([{ ...project, kind: "countdown" }]).success).toBe(false);
    expect(textSections.safeParse(Array.from({ length: 7 }, () => project)).success).toBe(false);
  });
  it("renders safe semantic project links with escaped creator content and hides private sections", () => {
    const profile = publishedProfile.parse({ username: "portfolio-example", display_name: "Portfolio", bio: "", theme: "midnight", indexable: false, avatar: null, links: [], appearance: { ...defaultAppearance, layout: "portfolio" }, sections: [{ ...project, heading: "<script>project</script>" }, { ...project, hidden: true, heading: "Private project" }] });
    const html = renderToStaticMarkup(createElement(ProfileCard, { profile }));
    expect(html).toContain('data-layout="portfolio"');
    expect(html).toContain('href="https://example.com/work"');
    expect(html).toContain('rel="ugc nofollow noreferrer"');
    expect(html).toContain('&lt;script&gt;project&lt;/script&gt;');
    expect(html).not.toContain('<script>project');
    expect(html).not.toContain('Private project');
    profile.sections[0].target = "javascript:alert(1)";
    expect(renderToStaticMarkup(createElement(ProfileCard, { profile }))).not.toContain('href=');
  });
});
