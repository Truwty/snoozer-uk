import type { MetadataRoute } from "next";
import { anonymousClient } from "@/lib/supabase";
import { siteUrl } from "@/lib/env";
import { sitemapEntries, type SitemapProfile } from "@/lib/sitemap";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const response = await anonymousClient().rpc("list_indexable_profile_sitemap");
  if (response.error) throw new Error("The public profile sitemap is temporarily unavailable.", { cause: response.error });
  const profiles = response.data as SitemapProfile[];
  return sitemapEntries(base, profiles);
}
