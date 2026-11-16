import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { anonymousClient, sessionClient } from "./supabase";
import { canonicalUsername, draftProfile, publishedProfile, username } from "./profile";

export async function requireAccount() {
  const client = await sessionClient();
  const { data, error } = await client.auth.getUser();
  if (error && (error.status === 0 || (error.status ?? 0) >= 500)) throw new Error("Account service unavailable.");
  if (!data.user?.email_confirmed_at) redirect("/sign-in");
  return { client, user: data.user };
}

export const readDraft = cache(async (profileId?: string) => {
  const { client } = await requireAccount();
  const { data, error } = await client.rpc("get_draft", profileId ? { p_profile: profileId } : undefined);
  if (error) throw new Error("Couldn’t load your draft.");
  return data === null ? null : draftProfile.parse(data);
});

export type StudioProfileQuery = { profile?: string | string[] };

export async function readStudioDraft(profile: StudioProfileQuery["profile"]) {
  if (profile === undefined) return readDraft();
  const id = z.uuid().safeParse(profile);
  if (!id.success) notFound();
  const draft = await readDraft(id.data);
  if (!draft) notFound();
  return draft;
}

export function studioHref(path: string, profileId?: string) {
  return profileId ? `${path}${path.includes("?") ? "&" : "?"}profile=${encodeURIComponent(profileId)}` : path;
}

export const readPublished = cache(async (name: string) => {
  const canonical = canonicalUsername(name);
  if (!username.safeParse(canonical).success) return null;
  const { data, error } = await anonymousClient().rpc("get_published_profile", { p_name: canonical });
  if (error) throw new Error("Couldn’t load this profile.");
  return data === null ? null : publishedProfile.parse(data);
});
