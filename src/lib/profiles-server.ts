import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { anonymousClient, sessionClient } from "./supabase";
import { canonicalUsername, draftProfile, publishedProfile, username } from "./profile";

export async function requireAccount() {
  const client = await sessionClient();
  const { data, error } = await client.auth.getUser();
  if (error && (error.status === 0 || (error.status ?? 0) >= 500)) throw new Error("Account service unavailable.");
  if (!data.user?.email_confirmed_at) redirect("/sign-in");
  return { client, user: data.user };
}

export const readDraft = cache(async () => {
  const { client } = await requireAccount();
  const { data, error } = await client.rpc("get_draft");
  if (error) throw new Error("Couldn’t load your draft.");
  return data === null ? null : draftProfile.parse(data);
});

export const readPublished = cache(async (name: string) => {
  const canonical = canonicalUsername(name);
  if (!username.safeParse(canonical).success) return null;
  const { data, error } = await anonymousClient().rpc("get_published_profile", { p_name: canonical });
  if (error) throw new Error("Couldn’t load this profile.");
  return data === null ? null : publishedProfile.parse(data);
});
