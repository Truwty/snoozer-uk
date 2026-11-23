"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAccount, studioHref } from "@/lib/profiles-server";
import { siteUrl } from "@/lib/env";
import { clearPending, currentSlot, markPending } from "@/lib/account-session-server";

const profileIdSchema = z.uuid();

export async function connectDiscordPresence(formData: FormData) {
  const profileId = profileIdSchema.safeParse(formData.get("profileId"));
  if (!profileId.success) redirect("/studio/discord?error=profile");

  const { client } = await requireAccount();
  const jar = await cookies();
  const slot = currentSlot(jar);
  markPending(jar, slot);

  const { data, error } = await client.auth.linkIdentity({
    provider: "discord",
    options: {
      redirectTo: new URL(`/auth/callback?flow=discord-presence&profile=${encodeURIComponent(profileId.data)}`, siteUrl()).href,
      scopes: "identify",
    },
  });
  if (error || !data.url) {
    clearPending(jar);
    redirect(studioHref("/studio/discord?error=link", profileId.data));
  }
  redirect(data.url);
}

export async function saveDiscordPresenceSettings(formData: FormData) {
  const profileId = profileIdSchema.safeParse(formData.get("profileId"));
  if (!profileId.success) redirect("/studio/discord?error=profile");

  const enabled = formData.get("enabled") === "on";
  const showStatus = formData.get("showStatus") === "on";
  const showActivity = formData.get("showActivity") === "on";
  const showCustomStatus = formData.get("showCustomStatus") === "on";
  if (enabled && !showStatus && !showActivity && !showCustomStatus) {
    redirect(studioHref("/studio/discord?error=fields", profileId.data));
  }

  const { client } = await requireAccount();
  const { error } = await client.rpc("discord_presence_save_settings", {
    p_profile: profileId.data,
    p_enabled: enabled,
    p_show_status: showStatus,
    p_show_activity: showActivity,
    p_show_custom_status: showCustomStatus,
  });
  if (error) {
    const code = error.code === "42501" ? "connect" : "save";
    redirect(studioHref(`/studio/discord?error=${code}`, profileId.data));
  }
  redirect(studioHref("/studio/discord?saved=1", profileId.data));
}

export async function disconnectDiscordPresence(formData: FormData) {
  const profileId = profileIdSchema.safeParse(formData.get("profileId"));
  if (!profileId.success) redirect("/studio/discord?error=profile");
  const { client } = await requireAccount();
  const { error } = await client.rpc("discord_presence_disconnect");
  redirect(studioHref(error ? "/studio/discord?error=disconnect" : "/studio/discord?disconnected=1", profileId.data));
}
