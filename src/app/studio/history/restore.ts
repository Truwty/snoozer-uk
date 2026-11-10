"use server";

import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/actions";
import { profileRevision } from "@/lib/profile";
import { requireAccount } from "@/lib/profiles-server";

export async function restorePublication(_: ActionState, form: FormData): Promise<ActionState> {
  const revision = profileRevision.safeParse(form.get("revision") ?? "-1");
  const expected = profileRevision.safeParse(form.get("draftRevision") ?? "-1");
  if (!revision.success || !expected.success) return { status: "error", message: "Invalid version. Reload this preview." };

  const { client } = await requireAccount();
  const { error } = await client.rpc("restore_publication", { p_revision: revision.data, p_expected: expected.data });
  if (error) return { status: "error", message: error.code === "40001"
    ? "The draft changed in another tab. Reload this preview before restoring."
    : "Couldn’t restore this version. It may no longer be in your publish history." };
  redirect("/studio?restored=1");
}
