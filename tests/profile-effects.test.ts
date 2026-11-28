import { describe, expect, it } from "vitest";
import { profileAppearance, defaultAppearance } from "../src/lib/profile";
import {
  defaultEffects, profileEffects, effectPresetsMap, effectsAllowed, resolveEffects,
  effectTierForOption, effectBackgrounds, effectParticles, effectBorders, effectLinks, effectTexts, effectInteractions,
  tiltEffectAngles,
} from "../src/lib/profile-effects";

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

  it("exposes a large bounded catalogue across all effect layers", () => {
    expect(effectBackgrounds.length).toBeGreaterThanOrEqual(24);
    expect(effectParticles.length).toBeGreaterThanOrEqual(20);
    expect(effectBorders.length).toBeGreaterThanOrEqual(18);
    expect(effectLinks.length).toBeGreaterThanOrEqual(17);
    expect(effectTexts.length).toBeGreaterThanOrEqual(20);
    expect(effectInteractions.length).toBeGreaterThanOrEqual(9);
    const samples = [
      { background: "singularity", tier: "studio" },
      { particles: "matrix-rain", tier: "studio" },
      { border: "hologram", tier: "studio" },
      { links: "3d-tilt", tier: "studio" },
      { text: "terminal", tier: "studio" },
      { interaction: "parallax", tier: "studio" },
    ] as const;
    for (const sample of samples) {
      const [key] = Object.keys(sample).filter((name) => name !== "tier");
      expect(effectTierForOption(key as Parameters<typeof effectTierForOption>[0], sample[key as keyof typeof sample] as string)).toBe("studio");
    }
  });

  it("allows a Free gradient while locking paid effects at their required tier", () => {
    const gradient = { ...defaultEffects, enabled: true, background: "gradient" } as const;
    expect(effectsAllowed(gradient, "free")).toBe(true);
    expect(effectTierForOption("background", "aurora")).toBe("plus");
    expect(effectTierForOption("background", "nebula")).toBe("pro");
    expect(effectTierForOption("background", "singularity")).toBe("studio");
    expect(effectsAllowed({ ...gradient, background: "aurora" }, "free")).toBe(false);
    expect(effectsAllowed({ ...gradient, background: "aurora" }, "plus")).toBe(true);
    expect(effectsAllowed({ ...gradient, background: "nebula" }, "plus")).toBe(false);
    expect(effectsAllowed({ ...gradient, background: "nebula" }, "pro")).toBe(true);
  });

  it("respects per-tier visual layer and interaction limits", () => {
    const plus = { ...defaultEffects, enabled: true, background: "aurora", border: "glow" } as const;
    expect(effectsAllowed(plus, "plus")).toBe(true);
    expect(effectsAllowed({ ...plus, particles: "fireflies" }, "plus")).toBe(false);
    const pro = { ...defaultEffects, enabled: true, background: "nebula", border: "chrome", interaction: "tilt" } as const;
    expect(effectsAllowed(pro, "plus")).toBe(false);
    expect(effectsAllowed(pro, "pro")).toBe(true);
    expect(effectsAllowed({ ...pro, particles: "meteors", links: "glass" }, "pro")).toBe(false);
  });

  it("keeps Studio presets and individual effects exclusive to Studio", () => {
    const studio = {
      ...defaultEffects, enabled: true, ...effectPresetsMap["deep-space"], preset: "deep-space",
    } as const;
    expect(effectsAllowed(studio, "pro")).toBe(false);
    expect(effectsAllowed(studio, "studio")).toBe(true);
    expect(effectTierForOption("preset", "solar-flare")).toBe("studio");
    expect(effectTierForOption("interaction", "orbit")).toBe("studio");
  });

  it("computes a much stronger pointer tilt at high intensity", () => {
    expect(tiltEffectAngles(0.5, 0.5, 100)).toEqual({ rotateX: 0, rotateY: 0 });
    const corner = tiltEffectAngles(0, 0, 100);
    expect(Math.abs(corner.rotateX)).toBeGreaterThanOrEqual(21);
    expect(Math.abs(corner.rotateY)).toBeGreaterThanOrEqual(27);
    const defaultCorner = tiltEffectAngles(0, 0, defaultEffects.intensity);
    expect(Math.abs(defaultCorner.rotateY)).toBeGreaterThan(17);
  });

  it("fails closed when a plan expires without erasing saved settings", () => {
    const premium = { ...defaultEffects, enabled: true, background: "aurora" } as const;
    expect(resolveEffects(premium, "free")).toEqual(defaultEffects);
    expect(resolveEffects(premium, "plus")).toEqual(premium);
  });
});
