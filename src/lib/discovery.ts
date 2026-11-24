import { z } from "zod";

export const discoveryCategories = [
  { value: "developers", label: "Developers", description: "Software, web and open-source projects" },
  { value: "designers", label: "Designers", description: "Interface, visual and product design" },
  { value: "artists", label: "Artists", description: "Illustration, photography and visual art" },
  { value: "content-creators", label: "Content creators", description: "People making videos, writing and online content" },
  { value: "gamers", label: "Gamers", description: "Gaming profiles, communities and projects" },
  { value: "streamers", label: "Streamers", description: "Live channels and streaming communities" },
  { value: "musicians", label: "Musicians", description: "Artists, producers and music projects" },
  { value: "businesses", label: "Businesses", description: "Independent businesses and professional pages" },
  { value: "communities", label: "Communities", description: "Groups, clubs and community projects" },
  { value: "other", label: "Other", description: "Something that does not fit another category" },
] as const;

export const discoveryTags = [
  "web-development", "software", "roblox", "gaming", "ui-ux", "graphic-design",
  "illustration", "photography", "video", "streaming", "music", "writing",
  "technology", "entrepreneurship", "education", "community", "open-source",
  "3d-art", "animation", "marketing", "fashion", "fitness", "podcasts", "indie",
] as const;

export const discoveryCategoryValues = discoveryCategories.map((item) => item.value);
export type DiscoveryCategory = typeof discoveryCategories[number]["value"];

export function discoveryCategoryLabel(value: string) {
  return discoveryCategories.find((item) => item.value === value)?.label ?? "Other";
}

export const discoveryProfile = z.object({
  username: z.string().regex(/^[a-z][a-z0-9-]{1,28}[a-z0-9]$/),
  display_name: z.string().min(1).max(60),
  bio: z.string().max(280),
  avatar: z.uuid().nullable(),
  category: z.enum(discoveryCategoryValues),
  tags: z.array(z.enum(discoveryTags)).max(5),
  has_verified_domain: z.boolean(),
  joined_at: z.string().min(1).max(64),
  rank_score: z.number().int().nonnegative(),
});

export const discoveryProfiles = z.array(discoveryProfile).max(25);

export const discoveryCollection = z.object({
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  collection_type: z.enum(["featured", "spotlight", "collection"]),
  title: z.string().min(2).max(72),
  description: z.string().max(280),
  sort_order: z.number().int(),
  created_at: z.string(),
  profiles: z.array(discoveryProfile.omit({ joined_at: true, rank_score: true })).max(20),
});

export const discoveryCollections = z.array(discoveryCollection).max(20);

export function encodeDiscoveryCursor(profile: z.infer<typeof discoveryProfile>, sort: "relevance" | "recent" | "name") {
  if (sort === "name") return "n|" + profile.username;
  if (sort === "recent") return "r|" + encodeURIComponent(profile.joined_at) + "|" + profile.username;
  return "s|" + profile.rank_score + "|" + encodeURIComponent(profile.joined_at) + "|" + profile.username;
}

export function decodeDiscoveryCursor(value: string | undefined, sort: "relevance" | "recent" | "name") {
  if (!value) return null;
  const parts = value.split("|");
  try {
    if (sort === "name" && parts.length === 2 && parts[0] === "n" &&
      /^[a-z][a-z0-9-]{1,28}[a-z0-9]$/.test(parts[1])) {
      return { score: null, timestamp: null, username: parts[1] };
    }
    if (sort === "recent" && parts.length === 3 && parts[0] === "r" &&
      /^[a-z][a-z0-9-]{1,28}[a-z0-9]$/.test(parts[2])) {
      const timestamp = decodeURIComponent(parts[1]);
      if (!Number.isFinite(Date.parse(timestamp))) return null;
      return { score: null, timestamp, username: parts[2] };
    }
    if (sort === "relevance" && parts.length === 4 && parts[0] === "s" &&
      /^\d{1,4}$/.test(parts[1]) && /^[a-z][a-z0-9-]{1,28}[a-z0-9]$/.test(parts[3])) {
      const timestamp = decodeURIComponent(parts[2]);
      if (!Number.isFinite(Date.parse(timestamp))) return null;
      return { score: Number(parts[1]), timestamp, username: parts[3] };
    }
  } catch {
    return null;
  }
  return null;
}

export function firstSearchValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}
