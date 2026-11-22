import { z } from "zod";

/** Allowlisted, bounded visual effects; no user-provided CSS or executable code. */
export const effectBackgrounds = ["none", "gradient", "aurora", "stars", "snow", "rain", "mesh"] as const;
export const effectBorders = ["none", "glow", "neon", "gradient"] as const;
export const effectTexts = ["none", "typewriter", "shimmer", "glitch"] as const;
export const effectInteractions = ["none", "tilt", "spotlight", "trail"] as const;
export const effectPresets = ["none", "lagoon-dream", "night-sky", "frost", "cyber", "studio-nebula"] as const;

export const profileEffects = z.strictObject({
  version: z.literal(1),
  enabled: z.boolean(),
  background: z.enum(effectBackgrounds),
  border: z.enum(effectBorders),
  text: z.enum(effectTexts),
  interaction: z.enum(effectInteractions),
  intensity: z.number().int().min(0).max(100),
  speed: z.enum(["slow", "normal", "fast"]),
  preset: z.enum(effectPresets),
});

export type ProfileEffects = z.infer<typeof profileEffects>;
export type EffectTier = "free" | "plus" | "pro" | "studio";

export const defaultEffects: ProfileEffects = {
  version: 1, enabled: false, background: "none", border: "none",
  text: "none", interaction: "none", intensity: 45, speed: "normal", preset: "none",
};

export const effectPresetsMap: Record<Exclude<ProfileEffects["preset"], "none">, Pick<ProfileEffects, "background" | "border" | "text" | "interaction">> = {
  "lagoon-dream": { background: "aurora", border: "glow", text: "none", interaction: "none" },
  "night-sky": { background: "stars", border: "none", text: "shimmer", interaction: "none" },
  frost: { background: "snow", border: "glow", text: "none", interaction: "none" },
  cyber: { background: "mesh", border: "neon", text: "glitch", interaction: "spotlight" },
  "studio-nebula": { background: "stars", border: "gradient", text: "shimmer", interaction: "trail" },
};

const rank: Record<EffectTier, number> = { free: 0, plus: 1, pro: 2, studio: 3 };

export function effectsAllowed(value: ProfileEffects, tier: EffectTier): boolean {
  if (!value.enabled) return true;
  if (value.preset === "studio-nebula" && tier !== "studio") return false;
  if (value.background === "gradient" && value.border === "none" && value.text === "none" && value.interaction === "none") return true;
  if (rank[tier] === 0) return false;
  if (value.interaction !== "none" && rank[tier] < 2) return false;
  if (value.preset === "studio-nebula" && rank[tier] < 3) return false;
  const active = [value.background, value.border, value.text, value.interaction].filter((v) => v !== "none").length;
  return active <= ({ free: 1, plus: 2, pro: 4, studio: 6 }[tier]);
}

/** Never display effects that the currently verified tier cannot use. */
export function resolveEffects(value: ProfileEffects | undefined, tier: EffectTier): ProfileEffects {
  const parsed = profileEffects.safeParse(value ?? defaultEffects);
  return parsed.success && effectsAllowed(parsed.data, tier) ? parsed.data : defaultEffects;
}
