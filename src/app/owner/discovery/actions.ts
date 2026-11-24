"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireOwner } from "@/lib/owner/auth";

const slug = z.string().trim().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).min(2).max(48);
const title = z.string().trim().min(2).max(72);
const collectionType = z.enum(["featured", "spotlight", "collection"]);
const description = z.string().max(280);
const reason = z.string().trim().min(8).max(500);

function parseDate(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.trim()) return null;
  // datetime-local inputs contain no timezone. The Owner UI labels these
  // values as UTC, so parse them explicitly rather than using the server's
  // local timezone.
  const hasTimezone = /(?:[zZ]|[+-]\\d{2}:\\d{2})$/.test(value);
  const date = new Date(hasTimezone ? value : value + "Z");
  return Number.isFinite(date.getTime()) ? date.toISOString() : "invalid";
}

export async function saveDiscoveryCollection(form: FormData) {
  const checkedSlug = slug.safeParse(form.get("slug"));
  const checkedTitle = title.safeParse(form.get("title"));
  const checkedType = collectionType.safeParse(form.get("collection_type"));
  const checkedDescription = description.safeParse(form.get("description") ?? "");
  const checkedReason = reason.safeParse(form.get("reason"));
  const profiles = z.array(z.string().regex(/^[a-z][a-z0-9-]{1,28}[a-z0-9]$/)).max(20)
    .safeParse(String(form.get("profiles") ?? "").split(/[\s,]+/).map((value) => value.trim()).filter(Boolean));
  const sortOrder = z.coerce.number().int().min(0).max(10000).safeParse(form.get("sort_order") ?? "0");
  const startsAt = parseDate(form.get("starts_at"));
  const expiresAt = parseDate(form.get("expires_at"));
  if (!checkedSlug.success || !checkedTitle.success || !checkedType.success || !checkedDescription.success || !checkedReason.success ||
    !profiles.success || !sortOrder.success || startsAt === "invalid" || expiresAt === "invalid" ||
    new Set(profiles.data).size !== profiles.data.length ||
    (startsAt && expiresAt && Date.parse(expiresAt) <= Date.parse(startsAt))) {
    redirect("/owner/discovery?status=invalid");
  }
  const { client } = await requireOwner();
  const { error } = await client.rpc("owner_upsert_discovery_collection", {
    p_slug: checkedSlug.data,
    p_collection_type: checkedType.data,
    p_title: checkedTitle.data,
    p_description: checkedDescription.data,
    p_published: form.get("published") === "on",
    p_sort_order: sortOrder.data,
    p_starts_at: startsAt,
    p_expires_at: expiresAt,
    p_usernames: profiles.data,
    p_reason: checkedReason.data,
  });
  if (error) redirect("/owner/discovery?status=" + (error.code === "42501" ? "mfa" : "failed"));
  revalidatePath("/discover");
  revalidatePath("/discover/collections/" + checkedSlug.data);
  redirect("/owner/discovery?status=saved");
}

export async function deleteDiscoveryCollection(form: FormData) {
  const checkedSlug = slug.safeParse(form.get("slug"));
  const checkedReason = reason.safeParse(form.get("reason"));
  if (!checkedSlug.success || !checkedReason.success) redirect("/owner/discovery?status=invalid");
  const { client } = await requireOwner();
  const { error } = await client.rpc("owner_delete_discovery_collection", {
    p_slug: checkedSlug.data, p_reason: checkedReason.data,
  });
  if (error) redirect("/owner/discovery?status=" + (error.code === "42501" ? "mfa" : "failed"));
  revalidatePath("/discover");
  revalidatePath("/discover/collections/" + checkedSlug.data);
  redirect("/owner/discovery?status=deleted");
}
