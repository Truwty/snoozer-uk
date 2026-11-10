"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/lib/actions";
import { canonicalUsername, profileContent, username } from "@/lib/profile";
import { requireAccount } from "@/lib/profiles-server";

export async function claim(_: ActionState, form: FormData): Promise<ActionState> {
  const name = username.safeParse(canonicalUsername(String(form.get("username") ?? "")));
  if (!name.success) return { status: "error", message: name.error.issues[0].message };
  const { client } = await requireAccount();
  const { error } = await client.rpc("claim_profile", { p_name: name.data });
  if (error?.code === "23505") return { status: "error", message: "That address is unavailable. If you already claimed a page, reload Studio." };
  if (error) return { status: "error", message: "Couldn’t claim your address. Try again." };
  redirect("/studio");
}

export async function save(_: ActionState, form: FormData): Promise<ActionState> {
  const revision = z.coerce.number().int().min(0).max(2147483646).safeParse(form.get("revision") ?? "-1");
  let links: unknown;
  try {
    links = JSON.parse(String(form.get("links") ?? ""));
  } catch {
    return { status: "error", message: "Couldn’t read the links. Reload Studio and try again." };
  }
  const content = profileContent.safeParse({
    display_name: form.get("display_name"),
    bio: form.get("bio"),
    theme: form.get("theme"),
    indexable: form.get("indexable") === "on",
    links,
  });
  if (!revision.success || !content.success) {
    return { status: "error", message: content.success ? "Invalid revision. Reload Studio." : content.error.issues[0].message };
  }

  const { client } = await requireAccount();
  const intent = form.get("intent");
  const { error } = await client.rpc("save_profile", {
      p_expected: revision.data,
      p_name: content.data.display_name,
      p_bio: content.data.bio,
      p_theme: content.data.theme,
      p_indexable: content.data.indexable,
      p_links: content.data.links.map(({ label, url }) => ({ label, url: new URL(url).href })),
      p_publish: intent === "publish",
      p_remove_avatar: form.get("remove_avatar") === "on",
    });
  if (error?.code === "40001") return { status: "error", message: "This draft changed in another tab. Copy any unsaved edits, then reload Studio." };
  if (error) return { status: "error", message: "Couldn’t save your changes. Try again." };
  revalidatePath("/studio");
  return {
    status: "success",
    message: intent === "publish" ? "Your page is live." : "Draft saved.",
  };
}
