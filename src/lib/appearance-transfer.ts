import { z } from "zod";
import { profileAppearance, themes, type PublishedProfile } from "./profile";

const transfer = z.strictObject({
  version: z.literal(1),
  theme: z.enum(themes),
  appearance: profileAppearance.omit({ backgroundImage: true }),
});
export const appearanceTransferLimit = 512;
export type AppearanceSettings = Omit<z.output<typeof transfer>, "version">;

export function exportAppearance(settings: Pick<PublishedProfile, "theme" | "appearance">) {
  const appearance = { ...settings.appearance };
  delete appearance.backgroundImage;
  return JSON.stringify({ version: 1, theme: settings.theme, appearance });
}

export function importAppearance(input: string): AppearanceSettings | null {
  if (input.length > appearanceTransferLimit) return null;
  try {
    const parsed = transfer.safeParse(JSON.parse(input));
    if (parsed.success) return { theme: parsed.data.theme, appearance: parsed.data.appearance };
  } catch {
    return null;
  }
  return null;
}
