"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAccount } from "@/lib/profiles-server";
import { discoveryCategories, discoveryTags } from "@/lib/discovery";

const category = z.enum(discoveryCategories.map((item) => item.value) as [typeof discoveryCategories[number]["value"], ...typeof discoveryCategories[number]["value"][]]);
const tag = z.enum(discoveryTags);

export async function saveDiscoverySettings(form: FormData) {
  const profileId = z.uuid().safeParse(form.get("profile"));
  const username = z.string().regex(/^[a-z][a-z0-9-]{1,28}[a-z0-9]$/).safeParse(form.get("username"));
  const selectedCategory = category.safeParse(form.get("category"));
  const tags = z.array(tag).max(5).safeParse(form.getAll("tag").map(String));
  if (!profileId.success || !username.success || !selectedCategory.success || !tags.success ||
    new Set(tags.data).size !== tags.data.length) {
    redirect("/studio/discovery?status=invalid");
  }

  const { client } = await requireAccount();
  const { error } = await client.rpc("set_profile_discovery_settings", {
    p_profile: profileId.data,
    p_directory_enabled: form.get("directory_enabled") === "on",
    p_leaderboard_enabled: form.get("leaderboard_enabled") === "on",
    p_recommendations_enabled: form.get("recommendations_enabled") === "on",
    p_category: selectedCategory.data,
    p_tags: tags.data,
  });
  if (error) redirect("/studio/discovery?profile=" + encodeURIComponent(profileId.data) + "&status=failed");
  revalidatePath("/discover");
  revalidatePath("/leaderboard");
  revalidatePath("/discover/category/" + selectedCategory.data);
  revalidatePath("/" + username.data);
  redirect("/studio/discovery?profile=" + encodeURIComponent(profileId.data) + "&status=saved");
}
