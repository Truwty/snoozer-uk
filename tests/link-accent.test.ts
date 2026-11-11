import { expect, it } from "vitest";
import { contrastRatio, linkAccents, linkAccentColours } from "../src/lib/link-accent";

it("computes reference contrast ratios", () => {
  expect(contrastRatio("#000000", "#ffffff")).toBe(21);
  expect(contrastRatio("#91efce", "#91efce")).toBe(1);
  expect(contrastRatio("#777777", "#ffffff")).toBeCloseTo(4.478, 3);
});

it("keeps every selectable accent above minimum text contrast", () => {
  expect(linkAccentColours("theme")).toBeUndefined();
  for (const accent of linkAccents) {
    if (accent === "theme") continue;
    const colours = linkAccentColours(accent);
    expect(colours?.ratio).toBeGreaterThanOrEqual(4.5);
  }
  expect(linkAccentColours("mint")?.foreground).toBe("#000000");
  expect(linkAccentColours("ink")?.foreground).toBe("#ffffff");
});
