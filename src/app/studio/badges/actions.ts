"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAccount } from "@/lib/profiles-server";
import { randomUUID } from "node:crypto";
import { encodeAvatar } from "@/lib/avatar";
import { storageAdmin } from "@/lib/supabase";

const profileId = z.uuid();
const badgeSlug = z.string().regex(/^[a-z0-9][a-z0-9-]{1,63}$/);

export async function saveBadgeVisibility(form: FormData) {
  const profile = profileId.safeParse(form.get("profile"));
  let rawOrder: unknown;
  try { rawOrder = JSON.parse(String(form.get("badgeOrder") ?? "[]")); } catch { rawOrder = null; }
  const requested = z.array(badgeSlug).max(256).safeParse(rawOrder);

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

export async function createCustomBadge(form: FormData) {
  const profile = profileId.safeParse(form.get("profile"));
  const title = z.string().trim().min(2).max(40).safeParse(form.get("title"));
  const description = z.string().trim().max(160).safeParse(form.get("description") ?? "");
  const icon = z.string().trim().min(1).max(8).refine((value) => !/[<>\u0000-\u001f\u007f]/.test(value)).safeParse(form.get("icon"));
  const color = z.string().regex(/^#[0-9a-fA-F]{6}$/).safeParse(form.get("color"));
  if (!profile.success || !title.success || !description.success || !icon.success || !color.success) redirect("/studio/badges?custom=invalid");
  const { client, user } = await requireAccount();
  const { data: badgeId, error } = await client.rpc("create_my_custom_badge", { p_profile: profile.data, p_title: title.data, p_description: description.data, p_icon: icon.data, p_color: color.data });
  if (error) redirect(`/studio/badges?profile=${encodeURIComponent(profile.data)}&custom=${error.code === "P1104" ? "limit" : "failed"}`);
  const parsedId = z.uuid().safeParse(badgeId);
  if (!parsedId.success) redirect(`/studio/badges?profile=${encodeURIComponent(profile.data)}&custom=failed`);
  const artwork = form.get("artwork");
  if (artwork instanceof File && artwork.size > 0) {
    if (artwork.size > 2 * 1024 * 1024 || !["image/jpeg","image/png","image/webp"].includes(artwork.type)) {
      await client.rpc("delete_my_custom_badge", { p_profile:profile.data,p_id:parsedId.data });
      redirect(`/studio/badges?profile=${encodeURIComponent(profile.data)}&custom=invalid`);
    }
    const imageId = randomUUID(); const key = `${user.id}/${imageId}.webp`; const bucket = storageAdmin().storage.from("custom-badges");
    let encoded: Buffer;
    try { encoded = await encodeAvatar(new Uint8Array(await artwork.arrayBuffer())); }
    catch {
      await client.rpc("delete_my_custom_badge", { p_profile:profile.data,p_id:parsedId.data });
      redirect(`/studio/badges?profile=${encodeURIComponent(profile.data)}&custom=invalid`);
    }
    const { error: uploadError } = await bucket.upload(key, encoded, { contentType:"image/webp",upsert:false });
    const { error: artworkError } = uploadError ? { error:uploadError } : await client.rpc("set_my_custom_badge_artwork", { p_profile:profile.data,p_id:parsedId.data,p_image_id:imageId });
    if (artworkError) {
      await bucket.remove([key]); await client.rpc("delete_my_custom_badge", { p_profile:profile.data,p_id:parsedId.data });
      redirect(`/studio/badges?profile=${encodeURIComponent(profile.data)}&custom=failed`);
    }
  }
  revalidatePath("/studio/badges"); revalidatePath("/studio");
  redirect(`/studio/badges?profile=${encodeURIComponent(profile.data)}&custom=saved`);
}

export async function saveCustomBadgeVisibility(form: FormData) {
  const profile = profileId.safeParse(form.get("profile"));
  let parsed: unknown;
  try { parsed = JSON.parse(String(form.get("customBadgeOrder") ?? "[]")); } catch { parsed = null; }
  const ids = z.array(z.uuid()).max(20).safeParse(parsed);
  if (!profile.success || !ids.success || new Set(ids.data).size !== ids.data.length) redirect("/studio/badges?custom=invalid");
  const { client } = await requireAccount();
  const { error } = await client.rpc("set_my_custom_badge_visibility", { p_profile: profile.data, p_ids: ids.data });
  if (error) redirect(`/studio/badges?profile=${encodeURIComponent(profile.data)}&custom=failed`);
  revalidatePath("/studio/badges"); revalidatePath("/studio");
  redirect(`/studio/badges?profile=${encodeURIComponent(profile.data)}&custom=saved`);
}

export async function deleteCustomBadge(form: FormData) {
  const profile = profileId.safeParse(form.get("profile")); const id = z.uuid().safeParse(form.get("id"));
  if (!profile.success || !id.success) redirect("/studio/badges?custom=invalid");
  const { client, user } = await requireAccount();
  const { data: owned } = await client.rpc("list_my_custom_badges", { p_profile:profile.data });
  const collection = z.array(z.object({ id:z.uuid(),image_id:z.uuid().nullable() })).safeParse(owned);
  const { error } = await client.rpc("delete_my_custom_badge", { p_profile: profile.data, p_id: id.data });
  if (error) redirect(`/studio/badges?profile=${encodeURIComponent(profile.data)}&custom=failed`);
  const imageId = collection.success ? collection.data.find((item)=>item.id===id.data)?.image_id : null;
  if (imageId) await storageAdmin().storage.from("custom-badges").remove([`${user.id}/${imageId}.webp`]);
  revalidatePath("/studio/badges"); revalidatePath("/studio");
  redirect(`/studio/badges?profile=${encodeURIComponent(profile.data)}&custom=saved`);
}

export async function updateCustomBadge(form: FormData) {
  const profile = profileId.safeParse(form.get("profile")); const id = z.uuid().safeParse(form.get("id"));
  const title = z.string().trim().min(2).max(40).safeParse(form.get("title"));
  const description = z.string().trim().max(160).safeParse(form.get("description") ?? "");
  const icon = z.string().trim().min(1).max(8).refine((value) => !/[<>\u0000-\u001f\u007f]/.test(value)).safeParse(form.get("icon"));
  const color = z.string().regex(/^#[0-9a-fA-F]{6}$/).safeParse(form.get("color"));
  if (!profile.success || !id.success || !title.success || !description.success || !icon.success || !color.success) redirect("/studio/badges?custom=invalid");
  const { client } = await requireAccount();
  const { error } = await client.rpc("update_my_custom_badge", { p_profile:profile.data,p_id:id.data,p_title:title.data,p_description:description.data,p_icon:icon.data,p_color:color.data });
  if (error) redirect(`/studio/badges?profile=${encodeURIComponent(profile.data)}&custom=failed`);
  revalidatePath("/studio/badges"); revalidatePath("/studio");
  redirect(`/studio/badges?profile=${encodeURIComponent(profile.data)}&custom=saved`);
}
