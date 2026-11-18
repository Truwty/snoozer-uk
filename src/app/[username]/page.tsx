import type { Metadata } from "next";
import { profileMetadata } from "@/lib/profile-metadata";
import Link from "next/link";
import { permanentRedirect } from "next/navigation";
import { ProfileAnalyticsConsent } from "@/components/profile-analytics-consent";
import { ProfileCard } from "@/components/profile-card";
import { siteUrl, supabaseKey, supabaseUrl } from "@/lib/env";
import { readPublished } from "@/lib/profiles-server";
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
  return <main className="public-page">
    <ProfileCard profile={profile} galleryBase={"/media/gallery/" + profile.username} avatarSrc={avatarPath(profile.username, profile.avatar)} />
    <ProfileAnalyticsConsent key={profile.username} username={profile.username} />
    <Link className="public-credit" href={siteUrl().href}>Made with Snoozer</Link>
  </main>;
}
