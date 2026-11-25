"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAccount } from "@/lib/profiles-server";

const profileId = z.uuid();
const badgeSlug = z.string().regex(/^[a-z0-9][a-z0-9-]{1,63}$/);

export async function saveBadgeVisibility(form: FormData) {
  const profile = profileId.safeParse(form.get("profile"));
  const requested = z.array(badgeSlug).max(256).safeParse(
    form.getAll("badge").map((value) => String(value)),
  );

  if (!profile.success || !requested.success) {
    redirect("/studio/badges?visibility=invalid");
  }

  const { client } = await requireAccount();
  const { error } = await client.rpc("set_my_profile_badge_visibility", {
    p_profile: profile.data,
    p_slugs: requested.data,
  });

  if (error) {
    redirect("/studio/badges?profile=" + encodeURIComponent(profile.data) + "&visibility=failed");
  }

  revalidatePath("/studio/badges");
  revalidatePath("/studio");
  redirect("/studio/badges?profile=" + encodeURIComponent(profile.data) + "&visibility=saved");
}
