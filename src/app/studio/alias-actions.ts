"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/actions";
import { canonicalUsername, username } from "@/lib/profile";
import { requireAccount } from "@/lib/profiles-server";

export async function manageAlias(_: ActionState, form: FormData): Promise<ActionState> {
  const input = z.object({ profile: z.uuid(), alias: username, operation: z.enum(["create", "renew", "retire"]) }).safeParse({ profile: form.get("profile"), alias: canonicalUsername(String(form.get("alias") ?? "")), operation: form.get("operation") });
  if (!input.success) return { status: "error", message: input.error.issues[0].message };
  const { client } = await requireAccount();
  const { error } = await client.rpc("manage_profile_alias", { p_profile: input.data.profile, p_name: input.data.alias, p_operation: input.data.operation });
  if (error?.code === "23505") return { status: "error", message: "That address is unavailable." };
  if (error?.code === "P1007") return { status: "error", message: "Your plan’s alias allowance has been reached. Plus or higher is required." };
  if (error?.code === "P1008") return { status: "error", message: "A retired alias cannot be renewed." };
  if (error?.code === "P1001") return { status: "error", message: "You can claim up to five aliases per UTC day." };
  if (error) return { status: "error", message: "Couldn’t change this alias. Reload and try again." };
  revalidatePath("/studio");
  return { status: "success", message: input.data.operation === "retire" ? "Alias retired. Its address remains reserved." : "Alias saved for 90 days." };
}
