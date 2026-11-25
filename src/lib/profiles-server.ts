import "server-only";
import { refreshDomain } from "./domains-server";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { anonymousClient, sessionClient } from "./supabase";
import { canonicalUsername, draftProfile, publishedProfile, username } from "./profile";
import { resolveEffects, type EffectTier } from "./profile-effects";

export async function requireAccount(nextPath = "/studio") {
  const client = await sessionClient();
  const { data, error } = await client.auth.getUser();
  if (error && (error.status === 0 || (error.status ?? 0) >= 500)) throw new Error("Account service unavailable.");
  if (!data.user?.email_confirmed_at) redirect("/sign-in?next=" + encodeURIComponent(nextPath));
  const assurance = await client.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance.error) throw new Error("Account security checks are unavailable.");
  if (assurance.data?.nextLevel === "aal2" && assurance.data.currentLevel !== "aal2") redirect("/auth/mfa?next=" + encodeURIComponent(nextPath));
  const { data: restricted, error: accessError } = await client.rpc("my_account_restriction");
  if (accessError) throw new Error("Account access checks are unavailable.");
  if (restricted) redirect("/account-restricted");
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

async function enforcePublicEffectTier(profile: z.infer<typeof publishedProfile>) {
  if (!profile.appearance.effects?.enabled) return profile;
  const effectsAllowedResult = await anonymousClient().rpc("profile_effects_allowed");
  if (effectsAllowedResult.error || effectsAllowedResult.data !== true)
    return { ...profile, appearance: { ...profile.appearance, effects: { ...profile.appearance.effects, enabled: false } } };
  const { data, error } = await anonymousClient().rpc("published_effect_tier", { p_name: profile.username });
  const tier: EffectTier = !error && (data === "plus" || data === "pro" || data === "studio") ? data : "free";
  return { ...profile, appearance: { ...profile.appearance, effects: resolveEffects(profile.appearance.effects, tier) } };
}

export const readPublished = cache(async (name: string) => {
  const canonical = canonicalUsername(name);
  if (!username.safeParse(canonical).success) return null;
  const { data, error } = await anonymousClient().rpc("get_published_profile", { p_name: canonical });
  if (error) throw new Error("Couldn’t load this profile.");
  if (data === null) return null;
  const profile = publishedProfile.parse(data);
  if (profile.domain_renewal && await refreshDomain(profile.domain_renewal) === "verified") {
    const renewed = await anonymousClient().rpc("get_published_profile", { p_name: canonical });
    if (renewed.error) throw new Error("Couldn’t load this profile.");
    return renewed.data === null ? null : enforcePublicEffectTier(publishedProfile.parse(renewed.data));
  }
  return enforcePublicEffectTier(profile);
});
