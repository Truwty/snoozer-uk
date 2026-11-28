import { z } from "zod";

/** Allowlisted, bounded visual effects; no user-provided CSS or executable code. */
export const effectBackgrounds = [
  "none", "gradient", "aurora", "stars", "snow", "rain", "mesh", "nebula", "galaxy", "sunset",
  "ocean", "vaporwave", "liquid-metal", "circuit", "matrix", "hologram", "prism", "aurora-borealis",
  "eclipse", "retro-grid", "supernova", "singularity", "quantum", "sakura-night",
] as const;
export const effectParticles = [
  "none", "dust", "fireflies", "sparkles", "embers", "bubbles", "petals", "snowflakes", "meteors",
  "confetti", "stars", "hearts", "electric", "shards", "data-stream", "sakura", "plasma", "smoke",
  "orbs", "butterflies", "comets", "matrix-rain",
] as const;
export const effectLinks = [
  "none", "lift", "shine", "glow", "magnetic", "bounce", "underline", "sweep", "pulse", "border-glow",
  "ripple", "tilt", "scale", "gradient", "glass", "glitch", "3d-tilt",
] as const;
export const effectBorders = [
  "none", "glow", "neon", "gradient", "pulse", "iridescent", "chrome", "glass", "aura", "scanline",
  "dashed", "corner-lights", "double", "plasma", "pixel", "hologram", "orbit", "prism",
] as const;
export const effectTexts = [
  "none", "typewriter", "shimmer", "glitch", "rainbow", "fuzzy", "shuffle", "neon", "chromatic",
  "wave", "pulse", "scanline", "outline", "gradient", "flicker", "blur-in", "letter-spacing", "aura",
  "scramble", "terminal",
] as const;
export const effectInteractions = [
  "none", "tilt", "spotlight", "trail", "magnetic", "parallax", "cursor-glow", "ripple", "orbit",
] as const;
export const effectPresets = [
  "none", "lagoon-dream", "night-sky", "frost", "cyber", "studio-nebula", "sunset-drive", "ocean-depths",
  "crystal-glass", "neon-overdrive", "sakura-bloom", "deep-space", "terminal-core", "solar-flare",
] as const;

export const profileEffects = z.strictObject({
  version: z.literal(1),
  enabled: z.boolean(),
  background: z.enum(effectBackgrounds),
  border: z.enum(effectBorders),
  particles: z.enum(effectParticles),
  links: z.enum(effectLinks),
  text: z.enum(effectTexts),
  interaction: z.enum(effectInteractions),
  intensity: z.number().int().min(0).max(100),
  speed: z.enum(["slow", "normal", "fast"]),
  preset: z.enum(effectPresets),
});

export type ProfileEffects = z.infer<typeof profileEffects>;
export type EffectTier = "free" | "plus" | "pro" | "studio";
export type EffectGroup = "background" | "border" | "particles" | "links" | "text" | "interaction" | "preset";

const tierRank: Record<EffectTier, number> = { free: 0, plus: 1, pro: 2, studio: 3 };
const optionTiers: Record<EffectGroup, Record<string, EffectTier>> = {
  background: {
    none: "free", gradient: "free",
    aurora: "plus", stars: "plus", snow: "plus", rain: "plus", mesh: "plus", sunset: "plus", ocean: "plus",
    nebula: "pro", galaxy: "pro", vaporwave: "pro", "liquid-metal": "pro", circuit: "pro", matrix: "pro",
    hologram: "pro", prism: "pro", "aurora-borealis": "pro", eclipse: "pro", "retro-grid": "pro", "sakura-night": "pro",
    supernova: "studio", singularity: "studio", quantum: "studio",
  },
  border: {
    none: "free",
    glow: "plus", neon: "plus", gradient: "plus", pulse: "plus", iridescent: "plus", glass: "plus", aura: "plus",
    chrome: "pro", scanline: "pro", dashed: "pro", "corner-lights": "pro", double: "pro", pixel: "pro", prism: "pro",
    plasma: "studio", hologram: "studio", orbit: "studio",
  },
  particles: {
    none: "free",
    dust: "plus", fireflies: "plus", sparkles: "plus", embers: "plus", bubbles: "plus", petals: "plus",
    snowflakes: "plus", stars: "plus",
    meteors: "pro", confetti: "pro", hearts: "pro", electric: "pro", shards: "pro", sakura: "pro",
    smoke: "pro", orbs: "pro", butterflies: "pro", comets: "pro",
    "data-stream": "studio", plasma: "studio", "matrix-rain": "studio",
  },
  links: {
    none: "free",
    lift: "plus", shine: "plus", glow: "plus", bounce: "plus", underline: "plus", sweep: "plus", pulse: "plus",
    "border-glow": "pro", ripple: "pro", tilt: "pro", scale: "pro", gradient: "pro", glass: "pro",
    magnetic: "studio", glitch: "studio", "3d-tilt": "studio",
  },
  text: {
    none: "free",
    typewriter: "plus", shimmer: "plus", rainbow: "plus", fuzzy: "plus", shuffle: "plus", neon: "plus",
    wave: "plus", pulse: "plus", outline: "plus", gradient: "plus", "blur-in": "plus",
    glitch: "pro", chromatic: "pro", scanline: "pro", flicker: "pro", "letter-spacing": "pro", aura: "pro",
    scramble: "studio", terminal: "studio",
  },
  interaction: {
    none: "free",
    tilt: "pro", spotlight: "pro", trail: "pro", ripple: "pro",
    magnetic: "studio", parallax: "studio", "cursor-glow": "studio", orbit: "studio",
  },
  preset: {
    none: "free",
    "lagoon-dream": "plus", "night-sky": "plus", frost: "plus", "sunset-drive": "plus", "ocean-depths": "plus",
    cyber: "pro", "crystal-glass": "pro", "neon-overdrive": "pro", "sakura-bloom": "pro",
    "studio-nebula": "studio", "deep-space": "studio", "terminal-core": "studio", "solar-flare": "studio",
  },
};

export function effectTierForOption(group: EffectGroup, value: string): EffectTier {
  return optionTiers[group][value] ?? "studio";
}

export const defaultEffects: ProfileEffects = {
  version: 1, enabled: false, background: "none", border: "none", particles: "none", links: "none",
  text: "none", interaction: "none", intensity: 70, speed: "normal", preset: "none",
};

type EffectLayers = Pick<ProfileEffects, "background" | "border" | "particles" | "links" | "text" | "interaction">;
export const effectPresetsMap: Record<Exclude<ProfileEffects["preset"], "none">, EffectLayers> = {
  "lagoon-dream": { background: "aurora", border: "glow", particles: "none", links: "none", text: "none", interaction: "none" },
  "night-sky": { background: "stars", border: "none", particles: "none", links: "none", text: "shimmer", interaction: "none" },
  frost: { background: "snow", border: "glow", particles: "none", links: "none", text: "none", interaction: "none" },
  cyber: { background: "matrix", border: "neon", particles: "none", links: "none", text: "glitch", interaction: "spotlight" },
  "studio-nebula": { background: "galaxy", border: "gradient", particles: "sparkles", links: "glow", text: "shimmer", interaction: "trail" },
  "sunset-drive": { background: "sunset", border: "iridescent", particles: "none", links: "none", text: "shimmer", interaction: "none" },
  "ocean-depths": { background: "ocean", border: "glass", particles: "bubbles", links: "none", text: "none", interaction: "none" },
  "crystal-glass": { background: "prism", border: "chrome", particles: "none", links: "glass", text: "chromatic", interaction: "tilt" },
  "neon-overdrive": { background: "vaporwave", border: "neon", particles: "none", links: "pulse", text: "glitch", interaction: "spotlight" },
  "sakura-bloom": { background: "sakura-night", border: "iridescent", particles: "petals", links: "sweep", text: "rainbow", interaction: "none" },
  "deep-space": { background: "supernova", border: "plasma", particles: "data-stream", links: "3d-tilt", text: "scramble", interaction: "orbit" },
  "terminal-core": { background: "matrix", border: "scanline", particles: "matrix-rain", links: "glitch", text: "terminal", interaction: "magnetic" },
  "solar-flare": { background: "supernova", border: "orbit", particles: "plasma", links: "magnetic", text: "flicker", interaction: "parallax" },
};

const effectGroups: Array<[EffectGroup, string]> = [
  ["background", "background"], ["border", "border"], ["particles", "particles"],
  ["links", "links"], ["text", "text"], ["interaction", "interaction"],
];

export function effectsAllowed(value: ProfileEffects, tier: EffectTier): boolean {
  if (!value.enabled) return true;
  if (effectTierForOption("preset", value.preset) > tier) return false;
  for (const [group, key] of effectGroups) {
    const option = value[key as keyof ProfileEffects];
    if (typeof option === "string" && effectTierForOption(group, option) > tier) return false;
  }
  const active = effectGroups.reduce((count, [, key]) => {
    return count + (value[key as keyof ProfileEffects] !== "none" ? 1 : 0);
  }, 0);
  if (tier === "free") {
    return value.background === "gradient"
      && value.border === "none" && value.particles === "none" && value.links === "none"
      && value.text === "none" && value.interaction === "none" && value.preset === "none";
  }
  if (tier === "plus" && value.interaction !== "none") return false;
  return active <= ({ free: 1, plus: 2, pro: 4, studio: 6 }[tier]);
}

/** Pointer-driven card tilt, capped to keep the card readable and on-screen. */
export function tiltEffectAngles(x: number, y: number, intensity: number) {
  const power = Math.max(0, Math.min(100, intensity)) / 100;
  const normalizedX = Math.max(0, Math.min(1, x));
  const normalizedY = Math.max(0, Math.min(1, y));
  return {
    rotateX: Number(((0.5 - normalizedY) * 44 * power).toFixed(2)),
    rotateY: Number(((normalizedX - 0.5) * 56 * power).toFixed(2)),
  };
}

/** Never display effects that the currently verified tier cannot use. */
export function resolveEffects(value: ProfileEffects | undefined, tier: EffectTier): ProfileEffects {
  const parsed = profileEffects.safeParse(value ?? defaultEffects);
  return parsed.success && effectsAllowed(parsed.data, tier) ? parsed.data : defaultEffects;
}
