import { describe, expect, it } from "vitest";
import { profileAppearance, defaultAppearance } from "../src/lib/profile";
import { defaultEffects, profileEffects, effectPresetsMap, effectsAllowed, resolveEffects } from "../src/lib/profile-effects";

describe("profile effects", () => {
  it("accepts bounded presets and rejects injected or invalid effect properties", () => {
    expect(profileEffects.parse(defaultEffects)).toEqual(defaultEffects);
    expect(profileAppearance.safeParse({ ...defaultAppearance, effects: defaultEffects }).success).toBe(true);
    for (const tampered of [
      { ...defaultEffects, background: "javascript:alert(1)" },
      { ...defaultEffects, css: "body{display:none}" },
      { ...defaultEffects, intensity: 1000 },
      { ...defaultEffects, speed: "unlimited" },
      { ...defaultEffects, version: 2 },
    ]) expect(profileEffects.safeParse(tampered).success).toBe(false);
  });

  it("respects free, Plus, Pro and Studio effect limits", () => {
    const gradient = { ...defaultEffects, enabled: true, background: "gradient" } as const;
    expect(effectsAllowed(gradient, "free")).toBe(true);
    const plus = { ...gradient, ...effectPresetsMap["lagoon-dream"] };
    expect(effectsAllowed(plus, "free")).toBe(false);
    expect(effectsAllowed(plus, "plus")).toBe(true);
    const pro = { ...plus, interaction: "spotlight" } as const;
    expect(effectsAllowed(pro, "plus")).toBe(false);
    expect(effectsAllowed(pro, "pro")).toBe(true);
    const studio = { ...gradient, ...effectPresetsMap["studio-nebula"], preset: "studio-nebula" } as const;
    expect(effectsAllowed(studio, "pro")).toBe(false);
    expect(effectsAllowed(studio, "studio")).toBe(true);
  });

  it("fails closed when a plan expires without erasing saved settings", () => {
    const premium = { ...defaultEffects, enabled: true, background: "aurora" } as const;
    expect(resolveEffects(premium, "free")).toEqual(defaultEffects);
    expect(resolveEffects(premium, "plus")).toEqual(premium);
  });
});
