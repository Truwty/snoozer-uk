import { describe, expect, it } from "vitest";
import { profileTemplateStyles } from "../src/lib/profile";
import { findTemplates, getTemplatePage, studioTemplates, templateCategories, templateFilters } from "../src/lib/studio-templates";

describe("first-party template discovery", () => {
  it("ships 120 designs across ten categories and thirty visual styles", () => {
    expect(studioTemplates).toHaveLength(120);
    expect(new Set(studioTemplates.map((item) => item.style)).size).toBe(30);
    expect(new Set(studioTemplates.map((item) => item.category)).size).toBe(10);
    expect(new Set(studioTemplates.map((item) => item.id)).size).toBe(120);
    expect(profileTemplateStyles).toHaveLength(30);
    expect(templateCategories).toHaveLength(10);
    expect(studioTemplates.every((item) => item.appearance.templateStyle === item.style)).toBe(true);
    expect(studioTemplates.every((item) => item.sections.length >= 1 && item.appearance.colors?.background)).toBe(true);
  });
  it("combines case-insensitive word, category, theme and layout filters", () => {
    expect(findTemplates(templateFilters({ q: "  sakura ", category: "anime" }))).toHaveLength(4);
    expect(findTemplates(templateFilters({ category: "minimal" }))).toHaveLength(12);
    expect(findTemplates(templateFilters({ layout: "editorial" })).length).toBeGreaterThan(24);
    expect(findTemplates(templateFilters({ theme: "lagoon" })).length).toBe(30);
    expect(findTemplates(templateFilters({}))).toEqual(studioTemplates);
  });
  it("bounds untrusted inputs and handles unknown, repeated and empty filters", () => {
    expect(templateFilters({ q: "x".repeat(1000), theme: "<script>", layout: ["centred", "portfolio"], category: "<script>" }))
      .toEqual({ q: "x".repeat(80), theme: "all", layout: "all", category: "all" });
    expect(templateFilters({ q: ["one", "two"] }).q).toBe("");
    expect(findTemplates(templateFilters({ q: "nonexistent-template" }))).toEqual([]);
    expect(findTemplates(templateFilters({ layout: "portfolio" })).length).toBeGreaterThan(0);
  });
  it("clamps gallery pagination to the number of matching templates", () => {
    expect(getTemplatePage("999", 120)).toEqual({ page: 5, pageCount: 5, start: 96 });
    expect(getTemplatePage("0", 120)).toEqual({ page: 1, pageCount: 5, start: 0 });
    expect(getTemplatePage("bad", 0)).toEqual({ page: 1, pageCount: 1, start: 0 });
  });
});
