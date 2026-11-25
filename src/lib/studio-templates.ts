import { defaultAppearance, profileLayouts, themes, type ProfileContent, type ProfileTemplateStyle, type TextSection } from "./profile";

export const templateCategories = [
  {
    "id": "minimal",
    "label": "Minimal"
  },
  {
    "id": "anime",
    "label": "Anime & illustration"
  },
  {
    "id": "cinematic",
    "label": "Cinematic"
  },
  {
    "id": "cyber",
    "label": "Cyber & tech"
  },
  {
    "id": "nature",
    "label": "Nature"
  },
  {
    "id": "gaming",
    "label": "Gaming"
  },
  {
    "id": "creative",
    "label": "Creative"
  },
  {
    "id": "music",
    "label": "Music"
  },
  {
    "id": "pastel",
    "label": "Pastel"
  },
  {
    "id": "luxe",
    "label": "Luxury"
  }
] as const;
export type TemplateCategory = typeof templateCategories[number]["id"];

type Palette = { id: string; name: string; theme: ProfileContent["theme"]; background: string; text: string; accent: string; icon: string; effect: string; gradientStart: string; gradientEnd: string };
const palettes: readonly Palette[] = [
  {
    "id": "nocturne",
    "name": "Nocturne",
    "theme": "midnight",
    "background": "#0c0d12",
    "text": "#f1f0f6",
    "accent": "#b8a9ed",
    "icon": "#f4f2fc",
    "effect": "#7865b5",
    "gradientStart": "#171521",
    "gradientEnd": "#202b3c"
  },
  {
    "id": "glacier",
    "name": "Glacier",
    "theme": "lagoon",
    "background": "#0c1920",
    "text": "#eafcff",
    "accent": "#76dce7",
    "icon": "#eafcff",
    "effect": "#3095a5",
    "gradientStart": "#103341",
    "gradientEnd": "#174e5a"
  },
  {
    "id": "parchment",
    "name": "Parchment",
    "theme": "daybreak",
    "background": "#f2eee5",
    "text": "#28231d",
    "accent": "#8a573b",
    "icon": "#28231d",
    "effect": "#c68d5d",
    "gradientStart": "#eee0cc",
    "gradientEnd": "#c8d8d0"
  },
  {
    "id": "afterglow",
    "name": "Afterglow",
    "theme": "midnight",
    "background": "#20111d",
    "text": "#fff0f6",
    "accent": "#f58abc",
    "icon": "#fff0f6",
    "effect": "#c04b86",
    "gradientStart": "#3c1732",
    "gradientEnd": "#5c2148"
  }
];
export const templatePalettes = palettes.map(({ id, name }) => ({ id, label: name }));

type Composition = {
  style: ProfileTemplateStyle; name: string; category: TemplateCategory; description: string;
  layout: ProfileContent["appearance"]["layout"]; density: ProfileContent["appearance"]["density"];
  corners: ProfileContent["appearance"]["corners"]; font: NonNullable<ProfileContent["appearance"]["font"]>;
  gradient: boolean; monochrome: boolean; animatedTitle: boolean; usernameGlow: boolean;
  socialGlow: boolean; badgeGlow: boolean; sectionOne: string; sectionTwo: string;
};
const compositions: readonly Composition[] = [
  { style: "slate", name: "Slate", category: "minimal", description: "A quiet, open composition with sharp hierarchy and generous negative space.", layout: "centred", density: "airy", corners: "soft", font: "sans", gradient: false, monochrome: true, animatedTitle: false, usernameGlow: false, socialGlow: false, badgeGlow: false, sectionOne: "A little about me", sectionTwo: "Elsewhere" },
  { style: "mono", name: "Monograph", category: "minimal", description: "A monochrome editorial page with precise type, restrained details and clean rhythm.", layout: "editorial", density: "compact", corners: "square", font: "mono", gradient: false, monochrome: true, animatedTitle: false, usernameGlow: false, socialGlow: false, badgeGlow: false, sectionOne: "Index", sectionTwo: "Selected notes" },
  { style: "paper", name: "Paper Margin", category: "minimal", description: "A warm paper-like canvas with typographic detail and a calm reading experience.", layout: "editorial", density: "balanced", corners: "square", font: "serif", gradient: false, monochrome: true, animatedTitle: false, usernameGlow: false, socialGlow: false, badgeGlow: false, sectionOne: "Introduction", sectionTwo: "Current reading" },
  { style: "sakura", name: "Sakura Dream", category: "anime", description: "Soft illustrated atmosphere, delicate highlights and a dreamy centred identity.", layout: "centred", density: "airy", corners: "round", font: "sans", gradient: true, monochrome: false, animatedTitle: true, usernameGlow: false, socialGlow: true, badgeGlow: false, sectionOne: "My world", sectionTwo: "Favourite moments" },
  { style: "oni", name: "Oni Bloom", category: "anime", description: "A dramatic illustration-inspired layout with dark contrast and sharp accent colour.", layout: "editorial", density: "balanced", corners: "square", font: "sans", gradient: true, monochrome: false, animatedTitle: false, usernameGlow: true, socialGlow: true, badgeGlow: true, sectionOne: "The story", sectionTwo: "Current arc" },
  { style: "cel", name: "Cel Shaded", category: "anime", description: "Bold blocks, layered colour and a graphic-panel feel inspired by animation.", layout: "portfolio", density: "compact", corners: "soft", font: "sans", gradient: true, monochrome: false, animatedTitle: false, usernameGlow: false, socialGlow: false, badgeGlow: true, sectionOne: "Character sheet", sectionTwo: "Favourite scenes" },
  { style: "noir", name: "Noir Frame", category: "cinematic", description: "A restrained film-still aesthetic with deep shadows and a focused portrait.", layout: "centred", density: "airy", corners: "square", font: "serif", gradient: true, monochrome: true, animatedTitle: false, usernameGlow: false, socialGlow: false, badgeGlow: false, sectionOne: "Opening scene", sectionTwo: "Credits" },
  { style: "dusk", name: "Last Light", category: "cinematic", description: "A soft dusk gradient with a spacious card and warm cinematic contrast.", layout: "centred", density: "airy", corners: "round", font: "sans", gradient: true, monochrome: false, animatedTitle: true, usernameGlow: true, socialGlow: false, badgeGlow: false, sectionOne: "At the moment", sectionTwo: "The soundtrack" },
  { style: "grain", name: "35mm Grain", category: "cinematic", description: "A textured, photographic-inspired page with a compact frame and subtle grain-like pattern.", layout: "editorial", density: "compact", corners: "soft", font: "serif", gradient: false, monochrome: true, animatedTitle: false, usernameGlow: false, socialGlow: false, badgeGlow: false, sectionOne: "Frames", sectionTwo: "Contact sheet" },
  { style: "terminal", name: "Terminal", category: "cyber", description: "A developer console-inspired profile with monospaced type and command-line rhythm.", layout: "editorial", density: "compact", corners: "square", font: "mono", gradient: false, monochrome: true, animatedTitle: false, usernameGlow: false, socialGlow: false, badgeGlow: false, sectionOne: "whoami", sectionTwo: "Projects" },
  { style: "matrix", name: "Green Matrix", category: "cyber", description: "High-contrast digital green, stacked surfaces and a focused cyber atmosphere.", layout: "centred", density: "balanced", corners: "square", font: "mono", gradient: true, monochrome: false, animatedTitle: true, usernameGlow: true, socialGlow: true, badgeGlow: false, sectionOne: "System status", sectionTwo: "Network" },
  { style: "synthwave", name: "Synthwave 84", category: "cyber", description: "Retro-futurist neon, horizon gradients and an expressive profile silhouette.", layout: "portfolio", density: "airy", corners: "round", font: "sans", gradient: true, monochrome: false, animatedTitle: true, usernameGlow: true, socialGlow: true, badgeGlow: true, sectionOne: "Signal", sectionTwo: "Broadcasts" },
  { style: "forest", name: "Moss & Fern", category: "nature", description: "A grounded forest palette with organic shapes and a gentle, natural feel.", layout: "centred", density: "airy", corners: "round", font: "serif", gradient: true, monochrome: false, animatedTitle: false, usernameGlow: false, socialGlow: false, badgeGlow: false, sectionOne: "Field notes", sectionTwo: "Small favourites" },
  { style: "ocean", name: "Deep Current", category: "nature", description: "Cool ocean depth, smooth surfaces and a clean, flowing content rhythm.", layout: "portfolio", density: "balanced", corners: "round", font: "sans", gradient: true, monochrome: false, animatedTitle: false, usernameGlow: false, socialGlow: true, badgeGlow: false, sectionOne: "Below the surface", sectionTwo: "Collected things" },
  { style: "desert", name: "Desert Bloom", category: "nature", description: "Sandstone warmth, long-form typography and a sun-washed editorial structure.", layout: "editorial", density: "airy", corners: "soft", font: "serif", gradient: true, monochrome: false, animatedTitle: false, usernameGlow: false, socialGlow: false, badgeGlow: false, sectionOne: "A short story", sectionTwo: "Places to return to" },
  { style: "arcade", name: "Arcade Cabinet", category: "gaming", description: "A playful arcade-inspired frame with pixel accents and high-energy colour.", layout: "centred", density: "compact", corners: "square", font: "mono", gradient: true, monochrome: false, animatedTitle: true, usernameGlow: true, socialGlow: true, badgeGlow: true, sectionOne: "Player one", sectionTwo: "High scores" },
  { style: "esports", name: "Esports Arena", category: "gaming", description: "A sharp competitive layout with a bold identity and structured team-card spacing.", layout: "editorial", density: "compact", corners: "square", font: "sans", gradient: true, monochrome: false, animatedTitle: false, usernameGlow: true, socialGlow: true, badgeGlow: true, sectionOne: "Roster", sectionTwo: "Achievements" },
  { style: "pixel", name: "Pixel Quest", category: "gaming", description: "Retro 8-bit geometry, crisp edges and a playful game-menu composition.", layout: "portfolio", density: "balanced", corners: "square", font: "mono", gradient: false, monochrome: true, animatedTitle: false, usernameGlow: false, socialGlow: false, badgeGlow: true, sectionOne: "Inventory", sectionTwo: "Quest log" },
  { style: "studio", name: "Creative Studio", category: "creative", description: "A portfolio-first page with clear project space and a refined studio identity.", layout: "portfolio", density: "airy", corners: "soft", font: "sans", gradient: false, monochrome: false, animatedTitle: false, usernameGlow: false, socialGlow: false, badgeGlow: false, sectionOne: "Selected work", sectionTwo: "What I do" },
  { style: "brutalist", name: "Brutalist Grid", category: "creative", description: "Oversized typographic attitude, hard edges and an intentionally raw composition.", layout: "editorial", density: "compact", corners: "square", font: "mono", gradient: false, monochrome: true, animatedTitle: false, usernameGlow: false, socialGlow: false, badgeGlow: false, sectionOne: "Manifesto", sectionTwo: "Work in progress" },
  { style: "gallery", name: "White Cube", category: "creative", description: "A gallery-like canvas with quiet framing and generous room for visual work.", layout: "portfolio", density: "airy", corners: "soft", font: "serif", gradient: false, monochrome: true, animatedTitle: false, usernameGlow: false, socialGlow: false, badgeGlow: false, sectionOne: "Exhibitions", sectionTwo: "Collected work" },
  { style: "vinyl", name: "Vinyl Room", category: "music", description: "Record-sleeve-inspired detail with circular motifs and a warm listening-room mood.", layout: "centred", density: "balanced", corners: "round", font: "serif", gradient: true, monochrome: false, animatedTitle: false, usernameGlow: false, socialGlow: true, badgeGlow: false, sectionOne: "On repeat", sectionTwo: "Recent discoveries" },
  { style: "waveform", name: "Waveform", category: "music", description: "A modern audio interface with rhythmic lines, bright highlights and compact content.", layout: "portfolio", density: "compact", corners: "soft", font: "mono", gradient: true, monochrome: false, animatedTitle: true, usernameGlow: true, socialGlow: true, badgeGlow: false, sectionOne: "Now playing", sectionTwo: "Upcoming sets" },
  { style: "backstage", name: "Backstage Pass", category: "music", description: "A dark tour-pass composition with bold labels and layered event-card details.", layout: "editorial", density: "compact", corners: "square", font: "sans", gradient: false, monochrome: true, animatedTitle: false, usernameGlow: false, socialGlow: false, badgeGlow: true, sectionOne: "Tour diary", sectionTwo: "The set list" },
  { style: "cloud", name: "Cloud Nine", category: "pastel", description: "Soft sky tones, rounded surfaces and a light, airy profile arrangement.", layout: "centred", density: "airy", corners: "round", font: "sans", gradient: true, monochrome: false, animatedTitle: false, usernameGlow: false, socialGlow: false, badgeGlow: false, sectionOne: "Little things", sectionTwo: "Currently loving" },
  { style: "bloom", name: "Soft Bloom", category: "pastel", description: "Gentle floral colour, delicate details and a friendly, balanced layout.", layout: "portfolio", density: "airy", corners: "round", font: "serif", gradient: true, monochrome: false, animatedTitle: false, usernameGlow: false, socialGlow: true, badgeGlow: false, sectionOne: "A few favourites", sectionTwo: "Things I make" },
  { style: "lilac", name: "Lilac Haze", category: "pastel", description: "A lavender haze with a centred identity and soft luminous highlights.", layout: "editorial", density: "balanced", corners: "soft", font: "sans", gradient: true, monochrome: false, animatedTitle: true, usernameGlow: true, socialGlow: false, badgeGlow: false, sectionOne: "About", sectionTwo: "Moodboard" },
  { style: "obsidian", name: "Obsidian Club", category: "luxe", description: "Deep black surfaces, understated metallic accents and a premium, quiet finish.", layout: "centred", density: "airy", corners: "soft", font: "sans", gradient: true, monochrome: true, animatedTitle: false, usernameGlow: false, socialGlow: false, badgeGlow: true, sectionOne: "The essentials", sectionTwo: "Private collection" },
  { style: "goldline", name: "Goldline", category: "luxe", description: "Fine gold detailing, editorial alignment and an elegant profile presentation.", layout: "editorial", density: "balanced", corners: "square", font: "serif", gradient: false, monochrome: true, animatedTitle: false, usernameGlow: false, socialGlow: false, badgeGlow: true, sectionOne: "Profile", sectionTwo: "Selected links" },
  { style: "velvet", name: "Velvet Room", category: "luxe", description: "Rich velvet tones, soft gradients and a spacious, lounge-like profile card.", layout: "portfolio", density: "airy", corners: "round", font: "serif", gradient: true, monochrome: false, animatedTitle: true, usernameGlow: true, socialGlow: true, badgeGlow: true, sectionOne: "The room", sectionTwo: "Curated favourites" }
];

export type StudioTemplate = {
  id: string; name: string; description: string; category: TemplateCategory; categoryLabel: string;
  style: ProfileTemplateStyle; palette: string; paletteId: string; theme: ProfileContent["theme"];
  sections: TextSection[]; appearance: ProfileContent["appearance"];
};
const categoryLabels = Object.fromEntries(templateCategories.map((item) => [item.id, item.label])) as Record<TemplateCategory, string>;

export const studioTemplates: readonly StudioTemplate[] = compositions.flatMap((composition) =>
  palettes.map((palette) => ({
    id: `${composition.style}-${palette.id}`,
    name: `${composition.name} · ${palette.name}`,
    description: composition.description,
    category: composition.category,
    categoryLabel: categoryLabels[composition.category],
    style: composition.style,
    palette: palette.name,
    paletteId: palette.id,
    theme: palette.theme,
    sections: [
      { heading: composition.sectionOne, body: "Make this space your own. Add a short introduction, a favourite detail or something you are working on." },
      { heading: composition.sectionTwo, body: "Choose what belongs here and keep the page personal to you." },
    ],
    appearance: {
      ...defaultAppearance,
      layout: composition.layout, density: composition.density, corners: composition.corners,
      font: composition.font, templateStyle: composition.style, gradientEnabled: composition.gradient,
      monochromeIcons: composition.monochrome, animatedTitle: composition.animatedTitle,
      usernameGlow: composition.usernameGlow, socialGlow: composition.socialGlow, badgeGlow: composition.badgeGlow,
      colors: { background: palette.background, text: palette.text, accent: palette.accent,
        icon: palette.icon, effect: palette.effect, gradientStart: palette.gradientStart, gradientEnd: palette.gradientEnd },
    },
  }))
);

export const templatePageSize = 24;
export function templateFilters(input: { q?: string | string[]; theme?: string | string[]; layout?: string | string[]; category?: string | string[]; palette?: string | string[] }) {
  return {
    q: typeof input.q === "string" ? input.q.trim().slice(0, 80) : "",
    theme: themes.find((theme) => theme === input.theme) ?? "all",
    layout: profileLayouts.find((layout) => layout === input.layout) ?? "all",
    category: templateCategories.find((category) => category.id === input.category)?.id ?? "all",
    palette: templatePalettes.find((palette) => palette.id === input.palette)?.id ?? "all",
  };
}
export function findTemplates(filters: ReturnType<typeof templateFilters>) {
  const words = filters.q.toLocaleLowerCase("en-GB").split(/\s+/).filter(Boolean);
  return studioTemplates.filter((template) => {
    const text = `${template.name} ${template.description} ${template.id} ${template.categoryLabel}`.toLocaleLowerCase("en-GB");
    return (filters.theme === "all" || template.theme === filters.theme)
      && (filters.layout === "all" || filters.layout === template.appearance.layout)
      && (filters.category === "all" || filters.category === template.category)
      && (filters.palette === "all" || filters.palette === template.paletteId)
      && words.every((word) => text.includes(word));
  });
}
export function getTemplatePage(input: string | string[] | undefined, total: number) {
  const raw = typeof input === "string" ? Number.parseInt(input, 10) : 1;
  const pageCount = Math.max(1, Math.ceil(total / templatePageSize));
  const page = Number.isFinite(raw) ? Math.min(pageCount, Math.max(1, raw)) : 1;
  return { page, pageCount, start: (page - 1) * templatePageSize };
}
