import { discoveryCategories } from "./discovery";
import type { MetadataRoute } from "next";

export type SitemapProfile = { username: string; last_modified: string };

export function sitemapEntries(origin: URL, profiles: readonly SitemapProfile[]): MetadataRoute.Sitemap {
  return [
    { url: origin.href, changeFrequency: "weekly", priority: 1 },
    { url: new URL("/templates", origin).href, changeFrequency: "monthly", priority: 0.7 },
    { url: new URL("/discover", origin).href, changeFrequency: "daily", priority: 0.8 },
    ...discoveryCategories.map((category) => ({ url: new URL("/discover/category/" + category.value, origin).href, changeFrequency: "weekly" as const, priority: 0.6 })),
    { url: new URL("/privacy", origin).href, changeFrequency: "yearly", priority: 0.3 },
    { url: new URL("/terms", origin).href, changeFrequency: "yearly", priority: 0.3 },
    ...profiles.map((profile) => ({
      url: new URL(`/${encodeURIComponent(profile.username)}`, origin).href,
      lastModified: new Date(profile.last_modified),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
  ];
}
