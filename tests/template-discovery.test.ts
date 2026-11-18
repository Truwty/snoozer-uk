import { describe, expect, it } from "vitest";
import { findTemplates, studioTemplates, templateFilters } from "../src/lib/studio-templates";

describe("first-party template discovery", () => {
  it("combines case-insensitive word, theme and layout filters", () => {
    const result = findTemplates(templateFilters({ q: "  NOTEBOOK compact ", theme: "midnight", layout: "centred" }));
    expect(result.map((item) => item.id)).toEqual(["project-notebook-compact"]);
    expect(findTemplates(templateFilters({ layout: "editorial" }))).toHaveLength(3);
    expect(findTemplates(templateFilters({}))).toEqual(studioTemplates);
  });
  it("bounds untrusted inputs and handles unknown, repeated and empty filters", () => {
    expect(templateFilters({ q: "x".repeat(1000), theme: "<script>", layout: ["centred", "portfolio"] })).toEqual({ q: "x".repeat(80), theme: "all", layout: "all" });
    expect(templateFilters({ q: ["one", "two"] }).q).toBe("");
    expect(findTemplates(templateFilters({ q: "nonexistent-template" }))).toEqual([]);
    expect(findTemplates(templateFilters({ layout: "portfolio" }))).toEqual([]);
  });
});
