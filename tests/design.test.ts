import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AnalyticsChart } from "../src/components/analytics-chart";
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { studioTemplates } from "../src/lib/studio-templates";
import { defaultAppearance, profileContent, username } from "../src/lib/profile";
import { contrastRatio } from "../src/lib/link-accent";

describe("design catalogue and token boundaries", () => {
  it("provides 120 valid, distinct templates using supported appearance settings", () => {
    expect(studioTemplates).toHaveLength(120);
    expect(new Set(studioTemplates.map((template) => template.id)).size).toBe(120);
    expect(new Set(studioTemplates.map((template) => template.style)).size).toBe(30);
    expect(new Set(studioTemplates.map((template) => template.category)).size).toBe(10);
    for (const template of studioTemplates) {
      expect(username.safeParse(template.id).success, template.id).toBe(true);
      expect(profileContent.safeParse({ display_name: template.name, bio: template.description, theme: template.theme,
        appearance: template.appearance ?? defaultAppearance, sections: template.sections, indexable: false, links: [] }).success).toBe(true);
    }
  });
  it("keeps a one-event chart scale distinct and exposes the exact values", () => {
    const markup = renderToStaticMarkup(createElement(AnalyticsChart, { rows: [{ day: "2026-11-18", views: 1, clicks: 0 }] }));
    expect(markup).toContain("<span>0.5</span>");
    expect(markup).toContain("2026-11-18: 1 views, 0 clicks");
  });
  it("keeps app text and action pairings above AA contrast in the shared palette", async () => {
    const css = await readFile(new URL("../src/app/tokens.css", import.meta.url), "utf8");
    const colour = (name: string) => css.match(new RegExp("--" + name + ": (#[0-9a-f]{6});"))![1];
    for (const surface of ["bg", "surface", "surface-2"]) {
      for (const text of ["text", "text-muted", "text-subtle", "danger", "ok"]) {
        expect(contrastRatio(colour(surface), colour(text)), text + "/" + surface).toBeGreaterThanOrEqual(4.5);
      }
    }
    for (const surface of ["bg", "surface", "surface-2"]) expect(contrastRatio(colour("preview-border"), colour(surface))).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(colour("accent"), colour("accent-ink"))).toBeGreaterThanOrEqual(4.5);
    for (const theme of ["midnight", "daybreak", "lagoon"]) {
      expect(contrastRatio(colour(theme + "-page"), colour(theme + "-text"))).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(colour(theme + "-page"), colour(theme + "-detail"))).toBeGreaterThanOrEqual(4.5);
    }
  });
});
