"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/lib/actions";
import { profileRevision, username } from "@/lib/profile";
import { requireAccount } from "@/lib/profiles-server";

export async function deleteProfile(_: ActionState, form: FormData): Promise<ActionState> {
  const expected = profileRevision.safeParse(form.get("revision") ?? "-1");
  const name = username.safeParse(form.get("confirmation"));
  const profile = z.uuid().safeParse(form.get("profileId"));
  if (!profile.success || !expected.success || !name.success || name.data !== form.get("username")) {
    return { status: "error", message: "Enter the exact username to confirm deletion." };
  }

  const { client } = await requireAccount();
  const { error } = await client.rpc("delete_profile", { p_profile: profile.data, p_expected: expected.data, p_username: name.data });
  if (error) return { status: "error", message: error.code === "P1010" ? "Disconnect your custom domain and confirm provider removal in Settings before deleting this profile." : error.code === "40001"
    ? "Your profile changed. Reload Studio before deleting it."
    : "Couldn’t delete your profile. Reload Studio to check its status before retrying." };
  redirect("/studio?deleted=1");
}
