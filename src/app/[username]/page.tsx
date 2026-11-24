import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { profileMetadata } from "@/lib/profile-metadata";
import Link from "next/link";
import { permanentRedirect } from "next/navigation";
import { ProfileAnalyticsConsent } from "@/components/profile-analytics-consent";
import { ProfileCard } from "@/components/profile-card";
import { discordPresencePublic } from "@/lib/discord-presence";
import { profileBackgroundImage } from "@/lib/profile";
import { siteUrl, supabaseKey, supabaseUrl } from "@/lib/env";
import { readPublished } from "@/lib/profiles-server";
import { anonymousClient, storageAdmin } from "@/lib/supabase";
import { notFound } from "next/navigation";

type Props = { params: Promise<{ username: string }> };

function avatarPath(username: string, avatar: string | null) {
  return avatar ? `/media/avatar/${username}/${avatar}` : undefined;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  if (!supabaseUrl || !supabaseKey) return { robots: { index: false, follow: false } };
  const profile = await readPublished((await params).username);
  if (!profile) return { robots: { index: false, follow: false } };
  return profileMetadata(profile, siteUrl());
}

export default async function Page({ params }: Props) {
  if (!supabaseUrl || !supabaseKey) notFound();
  const name = (await params).username;
  const profile = await readPublished(name);
  if (!profile) notFound();
  if (name !== profile.username) permanentRedirect(`/${profile.username}`);
  // A selected gallery photo backgrounds the whole published page, not only the card.
  const background = profileBackgroundImage(profile);
  const [ownerResult, presenceResult] = await Promise.all([
    anonymousClient().rpc("is_owner_profile", { p_name: profile.username }),
    process.env.DISCORD_PRESENCE_ENABLED === "true"
      ? storageAdmin().rpc("discord_presence_public", { p_username: profile.username })
      : Promise.resolve({ data: null, error: null }),
  ]);
  const presence = !presenceResult.error ? discordPresencePublic.safeParse(presenceResult.data) : null;
  const presenceNeedsRefresh = process.env.DISCORD_PRESENCE_ENABLED === "true"
    && (Boolean(presenceResult.error) || (presenceResult.data !== null && !presence?.success));
  const pageStyle = background
    ? { "--profile-background-image": `url("/media/gallery/${encodeURIComponent(profile.username)}/${encodeURIComponent(background.id)}")` } as CSSProperties
    : undefined;
  return <main className="public-page" data-background-image={background ? "true" : undefined} style={pageStyle}>
    <ProfileCard entryExperience profile={profile} ownerBadge={!ownerResult.error && ownerResult.data === true} discordPresence={presence?.success ? presence.data : null} discordPresenceRetry={presenceNeedsRefresh} reportBaseUrl={siteUrl().origin} galleryBase={"/media/gallery/" + profile.username} avatarSrc={avatarPath(profile.username, profile.avatar)} />
    <ProfileAnalyticsConsent key={profile.username} username={profile.username} />
    <Link className="public-report-link" href={new URL("/report/" + profile.username, siteUrl()).href}>Report profile</Link>
  </main>;
}
