import { domainName } from "./domains";
import { z } from "zod";
import { safeLink } from "./safe-link";
import { galleryItem, galleryLimit } from "./gallery";
import { linkAccents } from "./link-accent";
import { countdownTarget } from "./countdown";
import { profileEffects } from "./profile-effects";
import { defaultProfileWidgets, profileWidgets } from "./profile-widgets";
import { profilePageLayout } from "./profile-layout";
import { profileBlocks } from "./profile-blocks";

export const profileRevisionNumber = z.number().int().nonnegative().max(2147483646);
export const profileRevision = z.coerce.number().pipe(profileRevisionNumber);

export const themes = ["midnight", "daybreak", "lagoon"] as const;
export const profileDensities = ["compact", "balanced", "airy"] as const;
export const profileCorners = ["square", "soft", "round"] as const;
export const profileEntrances = ["none", "fade", "rise"] as const;
export const profileLayouts = ["centred", "editorial", "portfolio"] as const;
const profileHexColour = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a six-digit hexadecimal colour.");
const profileCustomColours = z.strictObject({
  background: profileHexColour.optional(),
  text: profileHexColour.optional(),
  accent: profileHexColour.optional(),
  icon: profileHexColour.optional(),
  effect: profileHexColour.optional(),
  gradientStart: profileHexColour.optional(),
  gradientEnd: profileHexColour.optional(),
});
export const defaultAppearance = {
  density: "balanced", corners: "soft", layout: "centred", accent: "theme", entrance: "none",
  font: "system", gradientEnabled: false, opacity: 100, blur: 0,
  monochromeIcons: false, animatedTitle: false, usernameGlow: false, socialGlow: false, badgeGlow: false,
} as const;
export const profileAppearance = z.strictObject({
  density: z.enum(profileDensities),
  corners: z.enum(profileCorners),
  layout: z.enum(profileLayouts).default(defaultAppearance.layout),
  accent: z.enum(linkAccents).default(defaultAppearance.accent),
  entrance: z.enum(profileEntrances).default(defaultAppearance.entrance),
  backgroundImage: z.uuid().optional(),
  effects: profileEffects.optional(),
  colors: profileCustomColours.optional(),
  font: z.enum(["system", "sans", "serif", "mono"]).optional(),
  gradientEnabled: z.boolean().optional(),
  opacity: z.number().int().min(40).max(100).optional(),
  blur: z.number().int().min(0).max(24).optional(),
  monochromeIcons: z.boolean().optional(),
  animatedTitle: z.boolean().optional(),
  usernameGlow: z.boolean().optional(),
  socialGlow: z.boolean().optional(),
  badgeGlow: z.boolean().optional(),
});
export const username = z.string().regex(/^[a-z][a-z0-9-]{1,28}[a-z0-9]$/, "Use 3–30 letters, numbers or hyphens. Start with a letter and end with a letter or number.");

export function canonicalUsername(value: string) {
  const trimmed = value.trim();
  return /^[A-Za-z0-9-]+$/.test(trimmed) ? trimmed.toLowerCase() : "";
}

export { safeLink } from "./safe-link";
export const freeProfileLinkLimit = 20;
export const maximumProfileLinkLimit = 2000;

export const link = z.object({
  label: z.string().trim().min(1, "Give each link a label.").max(80),
  url: z.string().trim().max(2048).refine(safeLink, "Enter an HTTP or HTTPS address with a public domain."),
  hidden: z.boolean().optional(),
});

export const textSectionLimits = { count: 6, heading: 80, body: 800 };
export const sectionKinds = ["text", "callout", "quote", "countdown", "project"] as const;
export const sectionLabels: Record<typeof sectionKinds[number], string> = {
  text: "Text", callout: "Callout", quote: "Quote", countdown: "Countdown", project: "Project",
};
const textSection = z.object({
  kind: z.enum(sectionKinds).optional(),
  target: z.string().optional(),
  hidden: z.boolean().optional(),
  locked: z.boolean().optional(),
  heading: z.string().trim().min(1, "Give each text section a heading.").refine(
    (value) => Array.from(value).length <= textSectionLimits.heading, "Section headings can be up to 80 characters."),
  body: z.string().trim().min(1, "Enter text for each section.").refine(
    (value) => Array.from(value).length <= textSectionLimits.body, "Sections can be up to 800 characters."),
}).superRefine((section, context) => {
  if (section.kind === "countdown" && !countdownTarget(section.target ?? "")) {
    context.addIssue({ code: "custom", path: ["target"], message: "Enter a valid countdown date and time in UTC." });
  } else if (section.kind === "project" && (!section.target || section.target.length > 2048 || !safeLink(section.target))) {
    context.addIssue({ code: "custom", path: ["target"], message: "Enter a public HTTP or HTTPS project address." });
  } else if (section.kind !== "countdown" && section.kind !== "project" && section.target !== undefined) {
    context.addIssue({ code: "custom", path: ["target"], message: "Only countdown and project sections have a target." });
  }
});
export type TextSection = z.infer<typeof textSection>;
export const textSections = z.array(textSection).max(textSectionLimits.count);

export const profileSeo = z.strictObject({ title: z.string().trim().max(70), description: z.string().trim().max(160) });

export const profileContent = z.object({
  seo: profileSeo.default({ title: "", description: "" }),
  display_name: z.string().trim().min(1, "Enter a display name.").max(60),
  bio: z.string().trim().max(280),
  theme: z.enum(themes),
  appearance: profileAppearance.default(defaultAppearance),
  indexable: z.boolean(),
  links: z.array(link).max(maximumProfileLinkLimit),
  sections: textSections.default([]),
  widgets: profileWidgets.default(defaultProfileWidgets),
  blocks: profileBlocks.default([]),
  pageLayout: profilePageLayout.default({ version: 1, items: [] }),
});

export const publishedProfile = profileContent.extend({
  custom_domain: domainName.optional(),
  domain_renewal: domainName.optional(),
  username,
  avatar: z.uuid().nullable(),
  gallery: z.array(galleryItem).max(galleryLimit).default([]),
});

export const draftProfile = publishedProfile.extend({
  profile_id: z.uuid(),
  revision: z.number().int().nonnegative(),
  published_revision: z.number().int().nonnegative().nullable(),
});

export type ProfileContent = z.infer<typeof profileContent>;
export type DraftProfile = z.infer<typeof draftProfile>;
export type PublishedProfile = z.infer<typeof publishedProfile>;

export function profileBackgroundImage(profile: Pick<PublishedProfile, "appearance" | "gallery">) {
  const id = profile.appearance.backgroundImage;
  return id ? profile.gallery.find((image) => image.id === id) ?? null : null;
}
