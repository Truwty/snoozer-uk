"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/lib/actions";
import { canonicalUsername, profileContent, profileRevisionNumber, textSections, username, type ProfileContent } from "@/lib/profile";
import { readDraft, requireAccount, studioHref } from "@/lib/profiles-server";
import { effectsAllowed } from "@/lib/profile-effects";
import { accountPlan } from "@/lib/entitlements";
import { normalizeProfileLinks } from "@/lib/profile-links";

export async function claim(_: ActionState, form: FormData): Promise<ActionState> {
  const name = username.safeParse(canonicalUsername(String(form.get("username") ?? "")));
  if (!name.success) return { status: "error", message: name.error.issues[0].message };
  const { client } = await requireAccount();
  const { error } = await client.rpc("claim_profile", { p_name: name.data });
  if (error?.code === "23505") return { status: "error", message: "That address is unavailable. If you already claimed a page, reload Studio." };
  if (error?.code === "P1001") return { status: "error", message: "You can claim one replacement address every 24 hours. Try again later." };
  if (error) return { status: "error", message: "Couldn’t claim your address. Try again." };
  redirect("/studio");
}

export async function claimAdditional(_: ActionState, form: FormData): Promise<ActionState> {
  const name = username.safeParse(canonicalUsername(String(form.get("username") ?? "")));
  if (!name.success) return { status: "error", message: name.error.issues[0].message };
  const { client } = await requireAccount();
  const { data, error } = await client.rpc("claim_additional_profile", { p_name: name.data });
  if (error?.code === "23505") return { status: "error", message: "That address is unavailable." };
  if (error?.code === "P1005") return { status: "error", message: "Your plan’s profile allowance has been reached." };
  if (error?.code === "P1001") return { status: "error", message: "You can claim one replacement address every 24 hours." };
  const profile = z.uuid().safeParse(data);
  if (error || !profile.success) return { status: "error", message: "Couldn’t claim your address. Try again." };
  redirect(studioHref("/studio/builder", profile.data));
}

const saveRequest = z.object({
  profileId: z.uuid(),
  revision: profileRevisionNumber,
  content: profileContent.extend({ sections: textSections }),
  intent: z.enum(["draft", "publish"]),
  removeAvatar: z.boolean(),
});

type SaveResult =
  | { status: "success"; revision: number; content: ProfileContent }
  | { status: "error"; message: string; conflict?: true };

export async function save(input: unknown): Promise<SaveResult> {
  const request = saveRequest.safeParse(input);
  if (!request.success) return { status: "error", message: request.error.issues[0].message };
  const { profileId, content, intent, revision, removeAvatar } = request.data;
  const { layout, accent, entrance, backgroundImage, effects, ...cardTokens } = content.appearance;
  const appearance = {
    ...cardTokens,
    ...(layout !== "centred" && { layout }),
    ...(accent !== "theme" && { accent }),
    ...(entrance !== "none" && { entrance }),
    ...(backgroundImage && { backgroundImage }),
    ...(effects && { effects }),
  };
  const links = normalizeProfileLinks(content.links);
  const { client } = await requireAccount();
  const planResult = await client.rpc("get_my_plan");
  const plan = accountPlan.safeParse(planResult.data);
  if (planResult.error || !plan.success) return { status: "error", message: "Couldn’t verify your current plan." };
  if (effects && !effectsAllowed(effects, plan.data.plan)) return { status: "error", message: "This effect combination is not available on your current plan." };
  const { data, error } = await client.rpc("save_profile", {
    p_profile: profileId,
    p_expected: revision,
    p_name: content.display_name,
    p_bio: content.bio,
    p_theme: content.theme,
    p_appearance: appearance,
    p_seo: content.seo,
    p_indexable: content.indexable,
    p_links: links,
    p_sections: content.sections.map((section) => ({ ...section, hidden: section.hidden ?? false, locked: section.locked ?? false })),
    p_publish: intent === "publish",
    p_remove_avatar: removeAvatar,
    p_widgets: content.widgets,
    p_page_layout: content.pageLayout,
    p_blocks: content.blocks,
  });
  if (error?.code === "P1010") return { status: "error", message: "These effects require a higher plan or exceed your plan’s limits." };
  if (error?.code === "P1004") return { status: "error", message: "Remove links until the draft fits your current allowance." };
  if (error?.code === "P1006") return { status: "error", message: "Publishing custom SEO metadata requires Plus or higher. Clear the overrides to use your display name and bio." };
  if (error?.code === "P1005") return { status: "error", message: "You’ve reached your plan’s published profile limit." };
  if (error?.code === "40001") {
    return { status: "error", conflict: true, message: "Your draft changed elsewhere. Copy your edits or load the saved draft." };
  }
  if (error || typeof data !== "number") return { status: "error", message: "Couldn’t save your changes. Try again." };
  revalidatePath("/studio");
  return { status: "success", revision: data, content: { ...content, links } };
}

export async function loadSavedDraft(profileId: string) {
  return readDraft(z.uuid().parse(profileId));
}
