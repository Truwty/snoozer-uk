"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAccount } from "@/lib/profiles-server";

function values(form: FormData) {
  return {
    profile: z.uuid().safeParse(form.get("profile")),
    entry: z.uuid().safeParse(form.get("entry")),
  };
}
function returnTo(profile: string, status: string): never {
  redirect("/studio/widgets/guestbook?profile=" + encodeURIComponent(profile) + "&status=" + status);
}

export async function moderateGuestbookEntry(form: FormData) {
  const parsed = values(form);
  const status = z.enum(["approved", "rejected"]).safeParse(form.get("status"));
  if (!parsed.profile.success || !parsed.entry.success || !status.success) redirect("/studio");
  const { client } = await requireAccount();
  const { data, error } = await client.rpc("moderate_guestbook_entry", {
    p_profile: parsed.profile.data, p_entry: parsed.entry.data, p_status: status.data,
  });
  revalidatePath("/studio/widgets/guestbook");
  returnTo(parsed.profile.data, !error && data === true ? status.data : "error");
}

export async function deleteGuestbookEntry(form: FormData) {
  const parsed = values(form);
  if (!parsed.profile.success || !parsed.entry.success) redirect("/studio");
  const { client } = await requireAccount();
  const { data, error } = await client.rpc("delete_guestbook_entry", {
    p_profile: parsed.profile.data, p_entry: parsed.entry.data,
  });
  revalidatePath("/studio/widgets/guestbook");
  returnTo(parsed.profile.data, !error && data === true ? "deleted" : "error");
}
