"use server";

import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/actions";
import { profileRevision, username } from "@/lib/profile";
import { requireAccount } from "@/lib/profiles-server";

export async function deleteProfile(_: ActionState, form: FormData): Promise<ActionState> {
  const expected = profileRevision.safeParse(form.get("revision") ?? "-1");
  const name = username.safeParse(form.get("confirmation"));
  if (!expected.success || !name.success || name.data !== form.get("username")) {
    return { status: "error", message: "Enter the exact username to confirm deletion." };
  }

  const { client } = await requireAccount();
  const { error } = await client.rpc("delete_profile", { p_expected: expected.data, p_username: name.data });
  if (error) return { status: "error", message: error.code === "40001"
    ? "Your profile changed. Reload Studio before deleting it."
    : "Couldn’t delete your profile. Reload Studio to check its status before retrying." };
  redirect("/studio?deleted=1");
}
