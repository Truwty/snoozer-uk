"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAccount } from "@/lib/profiles-server";
import type { ActionState } from "@/lib/actions";

export async function createCampaign(_: ActionState, form: FormData): Promise<ActionState> {
  const input = z.object({ profile: z.uuid(), label: z.string().trim().min(1).max(80) }).safeParse({
    profile: form.get("profile"), label: form.get("label"),
  });
  if (!input.success) return { status: "error", message: "Enter a campaign name of 1–80 characters." };
  const { client } = await requireAccount();
  const { error } = await client.rpc("create_analytics_campaign", { p_profile: input.data.profile, p_label: input.data.label });
  if (error?.code === "P1006") return { status: "error", message: "This profile has 20 saved campaigns. Reuse an existing campaign link." };
  if (error) return { status: "error", message: "Couldn’t create the campaign. Try again." };
  revalidatePath("/studio/analytics");
  return { status: "success", message: "Campaign link ready." };
}

export async function setCampaignActive(_: ActionState, form: FormData): Promise<ActionState> {
  const input = z.object({ profile: z.uuid(), campaign: z.uuid(), active: z.enum(["true", "false"]) }).safeParse({
    profile: form.get("profile"), campaign: form.get("campaign"), active: form.get("active"),
  });
  if (!input.success) return { status: "error", message: "Invalid campaign choice." };
  const { client } = await requireAccount();
  const { error } = await client.rpc("set_analytics_campaign_active", {
    p_profile: input.data.profile, p_campaign: input.data.campaign, p_active: input.data.active === "true",
  });
  if (error) return { status: "error", message: "Couldn’t update the campaign. Try again." };
  revalidatePath("/studio/analytics");
  return { status: "success", message: "Campaign updated." };
}
