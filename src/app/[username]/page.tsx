import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { profileMetadata } from "@/lib/profile-metadata";
import Link from "next/link";
import { permanentRedirect } from "next/navigation";
import { ProfileAnalyticsConsent } from "@/components/profile-analytics-consent";
import { ProfileCard } from "@/components/profile-card";
import { profileBackgroundImage } from "@/lib/profile";
import { siteUrl, supabaseKey, supabaseUrl } from "@/lib/env";
import { readPublished } from "@/lib/profiles-server";
import { anonymousClient } from "@/lib/supabase";
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
  const { data: ownerBadge, error: ownerError } = await anonymousClient().rpc("is_owner_profile", { p_name: profile.username });
  const pageStyle = background
    ? { "--profile-background-image": `url("/media/gallery/${encodeURIComponent(profile.username)}/${encodeURIComponent(background.id)}")` } as CSSProperties
    : undefined;
  return <main className="public-page" data-background-image={background ? "true" : undefined} style={pageStyle}>
    <ProfileCard profile={profile} ownerBadge={!ownerError && ownerBadge === true} galleryBase={"/media/gallery/" + profile.username} avatarSrc={avatarPath(profile.username, profile.avatar)} />
    <ProfileAnalyticsConsent key={profile.username} username={profile.username} />
    <div className="stack" style={{ alignItems: "center", marginTop: ".75rem" }}><Link href={new URL("/report/" + profile.username, siteUrl()).href} className="muted">Report profile</Link><Link className="public-credit" href={siteUrl().href}>Made with Snoozer</Link></div>
  </main>;
}
