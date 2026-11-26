"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAccount } from "@/lib/profiles-server";
import type { ActionState } from "@/lib/actions";
import { username } from "@/lib/profile";

export async function changeProfileUsername(_: ActionState, form: FormData): Promise<ActionState> {
  if (form.get("confirm_redirect") !== "on") return { status: "error", message: "Confirm that your old address will permanently redirect." };
  const input = z.object({ profile: z.uuid(), username }).safeParse({
    profile: form.get("profile"), username: form.get("username"),
  });
  if (!input.success) return { status: "error", message: "Use 3–30 lowercase letters, numbers or hyphens. Start with a letter and end with a letter or number." };

  const { client } = await requireAccount(`/studio/settings?profile=${encodeURIComponent(input.data.profile)}`);
  const { data, error } = await client.rpc("rename_my_profile", {
    p_profile: input.data.profile, p_name: input.data.username,
  });
  if (error?.code === "P1009") return { status: "error", message: "You can change this profile’s username once every 30 days." };
  if (error?.code === "23505") return { status: "error", message: "That username is already reserved. Try another one." };
  if (error?.code === "22023") return { status: "error", message: error.message.includes("already in use")
    ? "That is already this profile’s username." : "Enter a valid username." };
  if (error?.code === "42501") return { status: "error", message: "This profile is unavailable for a username change." };
  if (error || !data || typeof data !== "object" || !("oldUsername" in data) || !("username" in data))
    return { status: "error", message: "Could not change the username. Refresh and try again." };

  const changed = z.object({ oldUsername: username, username }).safeParse(data);
  if (!changed.success) return { status: "error", message: "The username changed, but its confirmation could not be read. Reload the page." };
  revalidatePath(`/${changed.data.oldUsername}`);
  revalidatePath(`/${changed.data.username}`);
  revalidatePath("/studio");
  revalidatePath("/studio/settings");
  return { status: "success", message: `Username changed to @${changed.data.username}. @${changed.data.oldUsername} now permanently redirects here.` };
}
