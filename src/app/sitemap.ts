import type { MetadataRoute } from "next";
import { anonymousClient } from "@/lib/supabase";
import { siteUrl } from "@/lib/env";
import { sitemapEntries, type SitemapProfile } from "@/lib/sitemap";
import { helpArticles, helpCategories } from "@/lib/help-content";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const response = await anonymousClient().rpc("list_indexable_profile_sitemap");
  if (response.error) throw new Error("The public profile sitemap is temporarily unavailable.", { cause: response.error });
  const profiles = response.data as SitemapProfile[];
  const helpPages: MetadataRoute.Sitemap = [
    "/help",
    "/help/changelog",
    "/help/contact",
    ...helpCategories.map((category) => `/help/category/${category.slug}`),
    ...helpArticles.map((article) => `/help/${article.slug}`),
  ].map((path) => ({
    url: new URL(path, base).href,
    changeFrequency: "monthly" as const,
    priority: path === "/help" ? 0.7 : 0.5,
  }));
  return [...sitemapEntries(base, profiles), ...helpPages];
}
