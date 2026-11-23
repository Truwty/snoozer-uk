"use server";
import { redirect } from "next/navigation";
import { requireAccount } from "@/lib/profiles-server";

export async function setSpotifyVisibility(form: FormData) {
  const { client } = await requireAccount();
  const enabled = form.get("enabled") === "yes";
  if (enabled && form.get("consent") !== "on") redirect("/studio/spotify?result=consent");
  const { data, error } = await client.rpc("spotify_set_visibility", { p_enabled: enabled });
  redirect("/studio/spotify?result=" + (error || !data ? "error" : enabled ? "public" : "private"));
}
export async function disconnectSpotify() {
  const { client } = await requireAccount();
  const { error } = await client.rpc("spotify_disconnect");
  redirect("/studio/spotify?result=" + (error ? "error" : "disconnected"));
}
