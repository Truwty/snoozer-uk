import type { Metadata } from "next";
import type { PublishedProfile } from "./profile";

export function profileMetadata(profile: PublishedProfile, origin: URL): Metadata {
  const title = profile.seo.title || profile.display_name;
  const description = profile.seo.description || profile.bio || `Links from @${profile.username} on Snoozer.`;
  const url = new URL(`/${profile.username}`, origin).href;
  const image = new URL(`/media/profile-card/${profile.username}`, origin).href;
  return {
    title, description, alternates: { canonical: url },
    robots: { index: profile.indexable, follow: profile.indexable },
    openGraph: { title, description, url, type: "profile", images: [{ url: image, width: 1200, height: 630, alt: `Profile preview for @${profile.username}` }] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}
