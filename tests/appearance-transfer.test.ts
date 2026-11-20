import { expect, it } from "vitest";
import { appearanceTransferLimit, exportAppearance, importAppearance } from "../src/lib/appearance-transfer";

it("round-trips validated appearance without exporting private profile content", () => {
  const settings = {
    theme: "daybreak",
    appearance: { density: "airy", corners: "square", layout: "editorial", accent: "mint", entrance: "fade" },
  } as const;
  const profile = { ...settings, bio: "Private draft", sections: [] };
  const backgroundImage = "00000000-0000-4000-8000-000000000011";
  const code = exportAppearance({ ...profile, appearance: { ...settings.appearance, backgroundImage } });
  expect(code).not.toContain(profile.bio);
  expect(code).not.toContain(backgroundImage);
  expect(importAppearance(code)).toEqual(settings);
});

it("rejects unsupported versions, tokens, and oversized input", () => {
  const appearance = { density: "airy", corners: "square", layout: "editorial", accent: "mint" };
  for (const payload of [
    { version: 2, theme: "daybreak", appearance },
    { version: 1, theme: "daybreak", appearance: { ...appearance, accent: "raw colour" } },
    { version: 1, theme: "daybreak", appearance: { ...appearance, backgroundImage: "00000000-0000-4000-8000-000000000011" } },
    { version: 1, theme: "daybreak", appearance, links: [] },
  ]) expect(importAppearance(JSON.stringify(payload))).toBeNull();
  expect(importAppearance(" ".repeat(appearanceTransferLimit) + "{}")).toBeNull();
  expect(importAppearance("{")).toBeNull();
});
