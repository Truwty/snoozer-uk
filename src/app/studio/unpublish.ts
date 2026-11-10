"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAccount } from "@/lib/profiles-server";
import type { ActionState } from "@/lib/actions";

export async function unpublish(_: ActionState, form: FormData): Promise<ActionState> {
  const revision = z.coerce.number().int().nonnegative().max(2147483646).safeParse(form.get("revision") ?? "-1");
  if (!revision.success) return { status: "error", message: "Invalid revision. Reload Studio." };
  const { client } = await requireAccount();
  const { error } = await client.rpc("unpublish_profile", { p_expected: revision.data });
  if (error) return { status: "error", message: error.code === "40001"
    ? "This draft changed in another tab. Reload Studio." : "Couldn’t take the page offline. Try again." };
  revalidatePath("/studio");
  return { status: "success", message: "Your page is offline." };
}
