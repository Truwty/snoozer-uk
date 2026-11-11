export const linkAccents = ["theme", "mint", "rose", "ink"] as const;
export type LinkAccent = typeof linkAccents[number];

export const linkAccentLabels: Record<LinkAccent, string> = {
  theme: "Use theme colours",
  mint: "Mint",
  rose: "Rose",
  ink: "Ink",
};

const backgrounds = { mint: "#91efce", rose: "#f3adc6", ink: "#25345f" };
const minimumTextContrast = 4.5;

function luminance(colour: string) {
  const linear = (offset: number) => {
    const channel = Number.parseInt(colour.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(1) + 0.7152 * linear(3) + 0.0722 * linear(5);
}

export function contrastRatio(first: string, second: string) {
  const a = luminance(first);
  const b = luminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

export function linkAccentColours(accent: LinkAccent) {
  if (accent === "theme") return undefined;
  const background = backgrounds[accent];
  const black = contrastRatio(background, "#000000");
  const white = contrastRatio(background, "#ffffff");
  const ratio = Math.max(black, white);
  if (ratio < minimumTextContrast) return undefined;
  return { background, foreground: black >= white ? "#000000" : "#ffffff", ratio };
}
