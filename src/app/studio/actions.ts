"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/lib/actions";
import { canonicalUsername, profileContent, profileRevisionNumber, textSections, username, type ProfileContent } from "@/lib/profile";
import { readDraft, requireAccount } from "@/lib/profiles-server";

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

const saveRequest = z.object({
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
  const { content, intent, revision, removeAvatar } = request.data;
  const { layout, accent, ...cardTokens } = content.appearance;
  const appearance = {
    ...cardTokens,
    ...(layout !== "centred" && { layout }),
    ...(accent !== "theme" && { accent }),
  };
  const links = content.links.map(({ label, url }) => ({ label, url: new URL(url).href }));
  const { client } = await requireAccount();
  const { data, error } = await client.rpc("save_profile", {
    p_expected: revision,
    p_name: content.display_name,
    p_bio: content.bio,
    p_theme: content.theme,
    p_appearance: appearance,
    p_indexable: content.indexable,
    p_links: links,
    p_sections: content.sections.map((section) => ({ ...section, hidden: section.hidden ?? false, locked: section.locked ?? false })),
    p_publish: intent === "publish",
    p_remove_avatar: removeAvatar,
  });
  if (error?.code === "40001") {
    return { status: "error", conflict: true, message: "Your draft changed elsewhere. Copy your edits or load the saved draft." };
  }
  if (error || typeof data !== "number") return { status: "error", message: "Couldn’t save your changes. Try again." };
  revalidatePath("/studio");
  return { status: "success", revision: data, content: { ...content, links } };
}

export async function loadSavedDraft() {
  return readDraft();
}
