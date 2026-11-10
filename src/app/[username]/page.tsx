import type { Metadata } from "next";
import Link from "next/link";
import { permanentRedirect } from "next/navigation";
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
  const url = new URL(`/${profile.username}`, siteUrl()).href;
  const description = profile.bio || `Links from @${profile.username} on Snoozer.`;
  const image = avatarPath(profile.username, profile.avatar);
  return {
    title: profile.display_name,
    description,
    alternates: { canonical: url },
    robots: { index: profile.indexable, follow: profile.indexable },
    openGraph: { title: profile.display_name, description, url, type: "profile", images: image ? [image] : undefined },
    twitter: { card: "summary", title: profile.display_name, description, images: image ? [image] : undefined },
  };
}

export default async function Page({ params }: Props) {
  if (!supabaseUrl || !supabaseKey) notFound();
  const name = (await params).username;
  const profile = await readPublished(name);
  if (name !== profile.username) permanentRedirect(`/${profile.username}`);
  return <main className="public-page">
    <ProfileCard profile={profile} avatarSrc={avatarPath(profile.username, profile.avatar)} />
    <Link className="public-credit" href="/">Made with Snoozer</Link>
  </main>;
}
