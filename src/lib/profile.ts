import { z } from "zod";

export const themes = ["midnight", "daybreak", "lagoon"] as const;
export const username = z.string().regex(/^[a-z][a-z0-9-]{1,28}[a-z0-9]$/, "Use 3–30 letters, numbers or hyphens. Start with a letter and end with a letter or number.");

export function canonicalUsername(value: string) {
  const trimmed = value.trim();
  return /^[A-Za-z0-9-]+$/.test(trimmed) ? trimmed.toLowerCase() : "";
}

export function safeLink(value: string) {
  if (!/^https?:\/\/[a-z0-9.-]+(?::[0-9]{1,5})?(?:[/?#][^\\\s]*)?$/i.test(value)) return false;
  try {
    const url = new URL(value);
    return /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(url.hostname)
      && !/\.(?:local|localhost|internal|test|invalid|example|onion)$/i.test(url.hostname);
  } catch {
    return false;
  }
}

export const link = z.object({
  label: z.string().trim().min(1, "Give each link a label.").max(80),
  url: z.string().trim().max(2048).refine(safeLink, "Enter an HTTP or HTTPS address with a public domain."),
});

export const profileContent = z.object({
  display_name: z.string().trim().min(1, "Enter a display name.").max(60),
  bio: z.string().trim().max(280),
  theme: z.enum(themes),
  indexable: z.boolean(),
  links: z.array(link).max(20),
});

export const publishedProfile = profileContent.extend({
  username,
  avatar: z.uuid().nullable(),
});

export const draftProfile = publishedProfile.extend({
  revision: z.number().int().nonnegative(),
  published_revision: z.number().int().nonnegative().nullable(),
});

export type ProfileContent = z.infer<typeof profileContent>;
export type DraftProfile = z.infer<typeof draftProfile>;
export type PublishedProfile = z.infer<typeof publishedProfile>;
